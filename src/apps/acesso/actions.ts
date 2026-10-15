'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { APP_PATHS } from '@/core/apps';
import { failure, type ActionFail } from '@/core/errors';
import { rpc } from '@/core/rpc';
import { createServerSupabase } from '@/core/supabase/server';
import { landingApp, loadContext, type ContextResult } from '@/core/tenant/context';

const credentials = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(6, 'Informe a senha.'),
});

function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

/** Login do estabelecimento: direciona para a área principal autorizada. */
export async function signInToTenant(slug: string, _prev: ActionFail | null, form: FormData): Promise<ActionFail | null> {
  const parsed = credentials.safeParse({ email: form.get('email'), password: form.get('password') });
  if (!parsed.success) return failure('INVALID', parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return failure('AUTH_FAILED', 'E-mail ou senha incorretos.');

  const base = (await headers()).get('x-pdp-base') ?? '';
  const { data, error: ctxError } = await supabase.rpc('my_context', { p_slug: slug });
  if (ctxError) return failure('ERROR', 'Não foi possível carregar seu acesso.');
  const ctx = data as ContextResult;
  if (ctx.state !== 'ok') redirect(`${base}/acesso?motivo=${ctx.state === 'tenant_inactive' ? 'assinatura' : 'sem-vinculo'}`);
  if (ctx.membership.must_change_password) redirect(`${base}/senha`);
  const next = safeNext(String(form.get('next') ?? ''));
  if (next) redirect(`${base}${next}`);
  const app = landingApp(ctx);
  if (!app) redirect(`${base}/acesso?motivo=sem-permissao`);
  redirect(`${base}${APP_PATHS[app]}`);
}

export async function requestPasswordReset(_prev: { done: boolean; error?: string } | null, form: FormData) {
  const email = z.email().safeParse(form.get('email'));
  if (!email.success) return { done: false, error: 'Informe um e-mail válido.' };
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${h.get('host')}`;
  const base = h.get('x-pdp-base') ?? '';
  const supabase = await createServerSupabase();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${origin}${base}/auth/confirm?next=${base}/senha` });
  // Mesma resposta para e-mails existentes ou não (não revela cadastros)
  return { done: true };
}

const passwordSchema = z
  .object({ password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres.'), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'As senhas não conferem.', path: ['confirm'] });

export async function changePassword(slug: string, _prev: ActionFail | null, form: FormData): Promise<ActionFail | null> {
  const parsed = passwordSchema.safeParse({ password: form.get('password'), confirm: form.get('confirm') });
  if (!parsed.success) return failure('INVALID', parsed.error.issues[0]?.message ?? 'Senha inválida.');
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return failure('AUTH_REQUIRED', 'Sessão expirada. Entre novamente.');
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return failure('ERROR', error.message);
  const ctx = await loadContext(slug);
  const base = (await headers()).get('x-pdp-base') ?? '';
  if (ctx.state === 'ok') {
    await rpc('member_password_changed', { p_tenant: ctx.tenant.id });
    const app = landingApp(ctx);
    redirect(`${base}${app ? APP_PATHS[app] : '/acesso?motivo=sem-permissao'}`);
  }
  redirect(`${base}/`);
}
