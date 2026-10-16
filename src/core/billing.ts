import 'server-only';
import { config } from '@/core/config';
import { failure, ok, type ActionResult } from '@/core/errors';
import { getAccessToken } from '@/core/supabase/server';

// Comunicação com o projeto `assinaturas`. As operações comerciais passam pela
// Edge Function `billing`, que valida a identidade no projeto `pontodopedido`.

export type { BillingOverview, Invoice, Plan, Subscription } from '@/core/plans';
export { planPriceLabel } from '@/core/plans';
import type { Plan } from '@/core/plans';

const PRODUCT_ID = 'ponto_do_pedido';

/** Catálogo público de planos (RLS: somente planos ativos). */
export async function fetchPlans(): Promise<Plan[]> {
  if (!config.billing.url) return [];
  try {
    const catalog = `${config.billing.url}/rest/v1/plans?select=*&active=eq.true&order=position`;
    let res = await fetch(`${catalog}&product_id=eq.${PRODUCT_ID}`, {
      headers: { apikey: config.billing.publishableKey },
      cache: 'no-store',
    });
    // Só o banco legado, que ainda não possui product_id, permite este fallback.
    // Falha de rede, função ausente ou produto inexistente nunca mistura catálogos.
    if (
      res.status === 400 &&
      (
        await res
          .clone()
          .json()
          .catch(() => null)
      )?.code === '42703'
    ) {
      res = await fetch(catalog, {
        headers: { apikey: config.billing.publishableKey },
        cache: 'no-store',
      });
    }
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
      body: JSON.stringify({ ...payload, action, product_id: PRODUCT_ID }),
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
  if (!res.ok || body?.error)
    return failure(body?.error?.code ?? 'SYNC_ERROR', body?.error?.message ?? 'Não foi possível sincronizar a licença.');
  if (!Array.isArray(body?.results)) return failure('SYNC_ERROR', 'Resposta inválida ao sincronizar a licença.');
  return ok(body);
}

/** Somente informa prontidão: não cria assinatura, checkout ou cobrança. */
export async function checkoutAvailable(): Promise<boolean> {
  const result = await billingCall<{ available: boolean }>('checkout_status');
  return result.ok === true && result.data?.available === true;
}
