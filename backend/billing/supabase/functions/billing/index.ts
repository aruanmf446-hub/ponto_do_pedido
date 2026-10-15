// Edge Function `billing` (projeto assinaturas).
//
// Autenticação: o chamador envia o access token emitido pelo projeto
// `pontodopedido` (autoridade de identidade). A função valida o token
// consultando `/auth/v1/user` daquele projeto — nunca confia em ids enviados
// pelo navegador. Somente então executa a operação com a chave secreta deste
// projeto. Nenhuma cobrança real é executada aqui. Sem dependências externas.

// Configuração pública (não secreta) do projeto de identidade. Pode ser
// sobrescrita por variáveis de ambiente no desenvolvimento local.
const IDENTITY_URL = Deno.env.get('PDP_IDENTITY_URL') ?? 'https://qmhtzosfbosgolevnybd.supabase.co';
const IDENTITY_PUBLISHABLE_KEY =
  Deno.env.get('PDP_IDENTITY_PUBLISHABLE_KEY') ?? 'sb_publishable_sapC0VZk-WmhVx__PB65HQ_N7s0dX_d';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

const ALLOWED_ORIGIN = Deno.env.get('PDP_ALLOWED_ORIGIN') ?? '*';
const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function fail(code: string, message: string, status = 400) {
  return json({ error: { code, message } }, status);
}

function secretKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}

const SECRET = secretKey();
const adminHeaders: Record<string, string> = { apikey: SECRET, 'Content-Type': 'application/json' };
if (!SECRET.startsWith('sb_')) adminHeaders.Authorization = `Bearer ${SECRET}`;

type RpcError = { message?: string; details?: string; code?: string };

async function rpc<T>(fn: string, args: unknown): Promise<{ data: T | null; error: RpcError | null }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify(args),
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) return { data: null, error: body ?? { message: res.statusText } };
  return { data: body as T, error: null };
}

type Identity = { id: string; email: string; name: string };

async function identify(req: Request): Promise<Identity | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const res = await fetch(`${IDENTITY_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: IDENTITY_PUBLISHABLE_KEY },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; email?: string; user_metadata?: { full_name?: string } };
  if (!user.id || !user.email) return null;
  return { id: user.id, email: user.email, name: user.user_metadata?.full_name ?? '' };
}

async function slugAvailable(slug: string): Promise<boolean> {
  const res = await fetch(`${IDENTITY_URL}/rest/v1/rpc/slug_available`, {
    method: 'POST',
    headers: { apikey: IDENTITY_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_slug: slug }),
  });
  if (!res.ok) throw new Error('Não foi possível validar o endereço do restaurante.');
  return (await res.json()) === true;
}

function failure(error: RpcError | null) {
  return fail(error?.details ?? error?.code ?? 'ERROR', error?.message ?? 'Erro inesperado.');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('METHOD', 'Use POST.', 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('INVALID', 'Requisição inválida.');
  }
  const action = String(body.action ?? '');

  const identity = await identify(req);
  if (!identity) return fail('AUTH_REQUIRED', 'Sessão expirada. Entre novamente.', 401);

  await rpc('billing_settle_expired', {});

  switch (action) {
    case 'overview':
    case 'entitlements': {
      const { data, error } = await rpc('billing_overview', { p_identity: identity.id });
      return error ? failure(error) : json(data);
    }
    case 'subscribe': {
      const slug = String(body.restaurant_slug ?? '').trim().toLowerCase();
      if (body.accept_terms !== true) return fail('TERMS_REQUIRED', 'É necessário aceitar os termos.');
      if (!(await slugAvailable(slug))) return fail('SLUG_TAKEN', 'Este endereço não está disponível.');
      const { data, error } = await rpc('billing_subscribe', {
        p_identity: identity.id,
        p_email: identity.email,
        p_name: String(body.name ?? identity.name ?? ''),
        p_plan: String(body.plan_code ?? ''),
        p_restaurant_name: String(body.restaurant_name ?? ''),
        p_slug: slug,
        p_user_agent: req.headers.get('user-agent') ?? '',
        p_idempotency_key: `${identity.id}:${String(body.idempotency_key ?? crypto.randomUUID())}`,
      });
      return error ? failure(error) : json(data);
    }
    case 'renew': {
      const { data, error } = await rpc('billing_renew', { p_identity: identity.id, p_subscription: body.subscription_id });
      return error ? failure(error) : json(data);
    }
    case 'change_plan': {
      const { data, error } = await rpc('billing_change_plan', {
        p_identity: identity.id,
        p_subscription: body.subscription_id,
        p_plan: body.plan_code,
      });
      return error ? failure(error) : json(data);
    }
    case 'cancel':
    case 'undo_cancel': {
      const { data, error } = await rpc('billing_cancel', {
        p_identity: identity.id,
        p_subscription: body.subscription_id,
        p_undo: action === 'undo_cancel',
      });
      return error ? failure(error) : json(data);
    }
    default:
      return fail('INVALID', 'Ação desconhecida.');
  }
});
