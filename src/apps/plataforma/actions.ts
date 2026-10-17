'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { billingCall, syncLicenses, type BillingOverview } from '@/core/billing';
import { failure, ok, type ActionFail, type ActionResult } from '@/core/errors';
import { rpc } from '@/core/rpc';
import { createServerSupabase } from '@/core/supabase/server';
import { isValidSlug } from '@/core/tenant/host';
import { safeAuthNext } from '@/core/auth/redirect';

async function origin(): Promise<string> {
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
}

function safePath(value: unknown, fallback: string): string {
  return safeAuthNext(value, fallback);
}

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.'),
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres.'),
});

export type SignupState = (ActionFail & { confirm?: false }) | { ok: true; confirm: true; email: string } | null;

/** Cria a conta do assinante (identidade única no projeto pontodopedido). */
export async function signUpSubscriber(_prev: SignupState, form: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({ name: form.get('name'), email: form.get('email'), password: form.get('password') });
  if (!parsed.success) return failure('INVALID', parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  const next = safePath(form.get('next'), '/contratar');
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name },
      emailRedirectTo: `${await origin()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (
      ['user_already_exists', 'email_exists'].includes(error.code ?? '') ||
      /already.*(registered|exists)/i.test(error.message)
    ) {
      return { ok: true, confirm: true, email: parsed.data.email };
    }
    return failure(
      'SIGNUP_FAILED',
      'Não foi possível concluir a solicitação agora. Confira os dados e tente novamente mais tarde.',
    );
  }
  if (!data.session) return { ok: true, confirm: true, email: parsed.data.email };
  redirect(next);
}

const signinSchema = z.object({ email: z.email('Informe um e-mail válido.'), password: z.string().min(1, 'Informe a senha.') });

export async function signInPlatform(_prev: ActionFail | null, form: FormData): Promise<ActionFail | null> {
  const parsed = signinSchema.safeParse({ email: form.get('email'), password: form.get('password') });
  if (!parsed.success) return failure('INVALID', parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return failure('AUTH_FAILED', 'E-mail ou senha incorretos.');
  redirect(safePath(form.get('next'), '/portal'));
}

export async function signOutPlatform(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/');
}

export async function checkSlug(slug: string): Promise<boolean> {
  if (!isValidSlug(slug)) return false;
  const result = await rpc<boolean>('slug_available', { p_slug: slug });
  return result.ok && result.data === true;
}

const subscribeSchema = z.object({
  plan: z.string().min(2, 'Escolha um plano.'),
  restaurant: z.string().trim().min(2, 'Informe o nome do restaurante.').max(120),
  slug: z.string().refine(isValidSlug, 'Endereço inválido: use letras minúsculas, números e hífen (3 a 40 caracteres).'),
  terms: z.literal('on', { error: 'É necessário aceitar os termos de uso.' }),
  key: z.string().min(8),
});

/** Contratação: assinatura pendente → checkout → pagamento confirmado → licença pelo Portal. */
export async function subscribe(_prev: ActionFail | null, form: FormData): Promise<ActionFail | null> {
  const parsed = subscribeSchema.safeParse({
    plan: form.get('plan'),
    restaurant: form.get('restaurant'),
    slug: String(form.get('slug') ?? '').toLowerCase(),
    terms: form.get('terms'),
    key: form.get('key'),
  });
  if (!parsed.success) return failure('INVALID', parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  const result = await billingCall<{ subscription_id: string; status: string }>('subscribe', {
    plan_code: parsed.data.plan,
    restaurant_name: parsed.data.restaurant,
    restaurant_slug: parsed.data.slug,
    accept_terms: true,
    idempotency_key: parsed.data.key,
  });
  if (!result.ok) return result;
  // Uma contratação pendente já foi registrada no billing: não trate a falta
  // de licença ativa como falha nem refaça a assinatura na tentativa seguinte.
  if (result.data.status === 'pending_payment') {
    // Com cobrança online habilitada, segue para o checkout. Sem ela (ou se falhar),
    // o Portal mostra a pendência e permite tentar de novo.
    const payment = await billingCall<{ checkout_url: string }>('start_payment', {
      subscription_id: result.data.subscription_id,
    });
    if (payment.ok) redirect(payment.data.checkout_url);
    redirect('/portal');
  }
  if (result.data.status !== 'active') {
    return failure(
      'SUBSCRIPTION_NOT_ACTIVE',
      'Sua assinatura foi registrada, mas ainda não está ativa. Consulte o Portal do Assinante.',
    );
  }
  const sync = await syncLicenses();
  if (!sync.ok) return sync;
  const provisioned = sync.data.results.find((r) => r.slug === parsed.data.slug);
  if (!provisioned?.tenant_id || provisioned.error) {
    return failure('SYNC_ERROR', provisioned?.error ?? 'A licença ainda não foi sincronizada. Tente novamente pelo Portal.');
  }
  redirect(`/portal/boas-vindas?r=${parsed.data.slug}`);
}

export async function subscriptionAction(
  action: 'renew' | 'change_plan' | 'cancel' | 'undo_cancel',
  subscriptionId: string,
  planCode?: string,
): Promise<ActionResult<null>> {
  const result = await billingCall(action, { subscription_id: subscriptionId, plan_code: planCode });
  if (!result.ok) return result;
  const sync = await syncLicenses();
  if (!sync.ok) return sync;
  const failed = sync.data.results.find((result) => result.error);
  return failed ? failure('SYNC_ERROR', failed.error!) : ok(null);
}

/** Inicia (ou retoma) o pagamento online; devolve o link do checkout do Mercado Pago. */
export async function startPayment(subscriptionId: string): Promise<ActionResult<{ checkout_url: string }>> {
  return billingCall<{ checkout_url: string }>('start_payment', { subscription_id: subscriptionId });
}

export async function refreshLicenses(): Promise<ActionResult<null>> {
  const sync = await syncLicenses();
  if (!sync.ok) return sync;
  const failed = sync.data.results.find((result) => result.error);
  return failed ? failure('SYNC_ERROR', failed.error!) : ok(null);
}

export async function getOverview(): Promise<ActionResult<BillingOverview>> {
  return billingCall<BillingOverview>('overview');
}

export async function markOnboarding(tenantId: string, step: string, status: 'done' | 'skipped' | 'pending') {
  return rpc<null>('onboarding_mark', { p_tenant: tenantId, p_step: step, p_status: status });
}

export async function finishOnboarding(tenantId: string) {
  return rpc<null>('onboarding_finish', { p_tenant: tenantId });
}
