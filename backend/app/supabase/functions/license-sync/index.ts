// Edge Function `license-sync` (projeto pontodopedido).
//
// Sincroniza as licenças do titular a partir do projeto `assinaturas`:
// 1. valida o usuário pelo token (Auth deste projeto);
// 2. consulta a Edge Function `billing` repassando o mesmo token — lá a
//    identidade é validada novamente e só as assinaturas do próprio titular
//    são retornadas;
// 3. grava estabelecimento, status, vigência e módulos com a chave secreta.
// O navegador não informa plano, módulos nem vigência: tudo vem da origem oficial.
import { adminRpc, bearer, cors, currentUser, fail, json } from '../_shared/http.ts';

const BILLING_URL = Deno.env.get('PDP_BILLING_URL') ?? 'https://bjtlookhgkdltdohzxnq.supabase.co';
const BILLING_PUBLISHABLE_KEY = Deno.env.get('PDP_BILLING_PUBLISHABLE_KEY') ?? 'sb_publishable_AcIiDIvMmRmlaP1ll7mvTA_8Ll8wucS';

type Subscription = {
  id: string;
  plan_code: string;
  modules: string[];
  status: 'pending_payment' | 'active' | 'past_due' | 'suspended' | 'cancelled';
  restaurant_name: string;
  restaurant_slug: string;
  current_period_end: string | null;
};

function tenantStatus(s: Subscription): 'pending' | 'active' | 'suspended' | 'cancelled' {
  switch (s.status) {
    case 'active':
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
  const token = bearer(req);
  if (!token) return fail('AUTH_REQUIRED', 'Sessão expirada.', 401);
  const user = await currentUser(token);
  if (!user) return fail('AUTH_REQUIRED', 'Sessão expirada.', 401);

  const res = await fetch(`${BILLING_URL}/functions/v1/billing`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: BILLING_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'entitlements' }),
  });
  if (!res.ok) {
    return fail('BILLING_UNAVAILABLE', 'Não foi possível consultar as assinaturas no momento.', 502);
  }
  const overview = (await res.json()) as { subscriptions: Subscription[] };
  const results: { slug: string; tenant_id?: string; error?: string }[] = [];

  for (const s of overview.subscriptions ?? []) {
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
    results.push(error ? { slug: s.restaurant_slug, error: error.message } : { slug: s.restaurant_slug, tenant_id: data ?? undefined });
  }
  return json({ results });
});
