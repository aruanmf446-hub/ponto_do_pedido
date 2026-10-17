// Edge Function `license-sync` (projeto pontodopedido).
//
// Sincroniza as licenças do titular a partir do projeto `assinaturas`:
// 1. valida o usuário pelo token (Auth deste projeto);
// 2. consulta a Edge Function `billing` repassando o mesmo token — lá a
//    identidade é validada novamente e só as assinaturas do próprio titular
//    são retornadas;
// 3. grava estabelecimento, status, vigência e módulos com a chave secreta.
// O navegador não informa plano, módulos nem vigência: tudo vem da origem oficial.
import { adminRpc, bearer, cors, currentUser, fail, integrationConfigured, json } from '../_shared/http.ts';

const BILLING_URL = Deno.env.get('PDP_BILLING_URL') ?? 'https://bjtlookhgkdltdohzxnq.supabase.co';
const BILLING_PUBLISHABLE_KEY = Deno.env.get('PDP_BILLING_PUBLISHABLE_KEY') ?? '';

type Subscription = {
  id: string;
  product_id?: string;
  plan_code: string;
  modules: string[];
  status: 'pending_payment' | 'active' | 'trialing' | 'past_due' | 'suspended' | 'cancelled';
  restaurant_name: string;
  restaurant_slug: string;
  current_period_end: string | null;
};

function tenantStatus(s: Subscription): 'pending' | 'active' | 'suspended' | 'cancelled' {
  switch (s.status) {
    case 'active':
    case 'trialing':
    case 'past_due':
      return 'active';
    case 'suspended':
      return 'suspended';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('METHOD', 'Use POST.', 405);
  if (!integrationConfigured() || !BILLING_PUBLISHABLE_KEY) {
    return fail('CONFIG_ERROR', 'Configuração de integração incompleta.', 503);
  }
  const token = bearer(req);
  if (!token) return fail('AUTH_REQUIRED', 'Sessão expirada.', 401);
  const user = await currentUser(token);
  if (!user) return fail('AUTH_REQUIRED', 'Sessão expirada.', 401);

  let subscriptions: Subscription[];
  try {
    const res = await fetch(`${BILLING_URL}/functions/v1/billing`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: BILLING_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'entitlements', product_id: 'ponto_do_pedido' }),
    });
    if (!res.ok) {
      return fail('BILLING_UNAVAILABLE', 'Não foi possível consultar as assinaturas no momento.', 502);
    }
    const overview = (await res.json()) as { product_id?: string; subscriptions?: unknown };
    if (!Array.isArray(overview.subscriptions)) throw new Error('Invalid entitlements');
    if (overview.product_id !== undefined && overview.product_id !== 'ponto_do_pedido') throw new Error('Invalid product');
    subscriptions = overview.subscriptions as Subscription[];
    if (subscriptions.some((s) => s.product_id !== undefined && s.product_id !== 'ponto_do_pedido'))
      throw new Error('Invalid subscription product');
  } catch {
    // Não registrar payloads nem detalhes da rede: podem conter credenciais.
    return fail('BILLING_UNAVAILABLE', 'Não foi possível consultar as assinaturas no momento.', 502);
  }
  const results: { slug: string; tenant_id?: string; error?: string }[] = [];

  for (const s of subscriptions) {
    if (s.status === 'pending_payment') {
      results.push({ slug: s.restaurant_slug, error: 'Aguardando ativação da assinatura.' });
      continue;
    }
    const { data, error } = await adminRpc<string>('admin_sync_license', {
      p_owner: user.id,
      p_subscription_id: s.id,
      p_slug: s.restaurant_slug,
      p_name: s.restaurant_name,
      p_status: tenantStatus(s),
      p_plan_code: s.plan_code,
      p_valid_until: s.current_period_end,
      p_modules: s.modules,
    });
    results.push(
      error ? { slug: s.restaurant_slug, error: error.message } : { slug: s.restaurant_slug, tenant_id: data ?? undefined },
    );
  }
  return json({ results });
});
