import 'server-only';
import { config } from '@/core/config';
import { failure, ok, type ActionResult } from '@/core/errors';
import { getAccessToken } from '@/core/supabase/server';

// Comunicação com o projeto `assinaturas`. As operações comerciais passam pela
// Edge Function `billing`, que valida a identidade no projeto `pontodopedido`.

export type Plan = {
  code: string;
  name: string;
  tagline: string;
  description: string;
  modules: string[];
  price_cents: number | null;
  billing_period: 'monthly' | 'yearly';
  highlights: string[];
  position: number;
};

export type Invoice = {
  id: string;
  amount_cents: number | null;
  period_start: string;
  period_end: string;
  due_date: string;
  status: 'open' | 'paid' | 'void';
};

export type Subscription = {
  id: string;
  plan_code: string;
  plan_name: string;
  modules: string[];
  price_cents: number | null;
  billing_period: 'monthly' | 'yearly';
  status: 'pending_payment' | 'active' | 'past_due' | 'suspended' | 'cancelled';
  restaurant_name: string;
  restaurant_slug: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  invoices: Invoice[];
};

export type BillingOverview = {
  account: { id: string; email: string; name: string } | null;
  payment_provider: string | null;
  subscriptions: Subscription[];
};

/** Catálogo público de planos (RLS: somente planos ativos). */
export async function fetchPlans(): Promise<Plan[]> {
  if (!config.billing.url) return [];
  try {
    const res = await fetch(`${config.billing.url}/rest/v1/plans?select=*&active=eq.true&order=position`, {
      headers: { apikey: config.billing.publishableKey },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return (await res.json()) as Plan[];
  } catch {
    return [];
  }
}

export async function billingCall<T>(action: string, payload: Record<string, unknown> = {}): Promise<ActionResult<T>> {
  const token = await getAccessToken();
  if (!token) return failure('AUTH_REQUIRED', 'Sessão expirada. Entre novamente.');
  let res: Response;
  try {
    res = await fetch(`${config.billing.url}/functions/v1/billing`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: config.billing.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
      cache: 'no-store',
    });
  } catch {
    return failure('BILLING_UNAVAILABLE', 'Serviço de assinaturas indisponível. Tente novamente.');
  }
  const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
  if (!res.ok || body?.error) {
    return failure(body?.error?.code ?? 'BILLING_ERROR', body?.error?.message ?? 'Serviço de assinaturas indisponível.');
  }
  return ok(body as T);
}

/** Sincroniza licenças: o projeto operacional consulta a origem oficial. */
export async function syncLicenses(): Promise<ActionResult<{ results: { slug: string; tenant_id?: string; error?: string }[] }>> {
  const token = await getAccessToken();
  if (!token) return failure('AUTH_REQUIRED', 'Sessão expirada. Entre novamente.');
  let res: Response;
  try {
    res = await fetch(`${config.app.url}/functions/v1/license-sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: config.app.publishableKey, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    });
  } catch {
    return failure('SYNC_UNAVAILABLE', 'Não foi possível sincronizar a licença. Tente novamente.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) return failure(body?.error?.code ?? 'SYNC_ERROR', body?.error?.message ?? 'Não foi possível sincronizar a licença.');
  return ok(body);
}

export function planPriceLabel(plan: Pick<Plan, 'price_cents' | 'billing_period'>): string {
  if (plan.price_cents == null) return 'Valor sob consulta';
  const value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.price_cents / 100);
  return `${value}/${plan.billing_period === 'yearly' ? 'ano' : 'mês'}`;
}
