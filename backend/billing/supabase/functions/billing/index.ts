// Edge Function `billing` (projeto assinaturas).
//
// Billing central CRM PLUS: cada produto autoriza seu próprio projeto Auth.
// A identidade vem exclusivamente de /auth/v1/user do produto cadastrado.
import { buildPreapprovalBody, MP_API } from '../_shared/mercadopago.ts';

const LEGACY_PRODUCT = 'ponto_do_pedido';
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

type PaymentContext = {
  subscription_id: string;
  plan_name: string;
  amount_cents: number;
  billing_period: 'monthly' | 'yearly';
  restaurant_name: string;
  payer_email: string;
  checkout_url: string | null;
};

type Product = {
  id: string;
  name: string;
  auth_url: string;
  auth_publishable_key: string;
  allowed_return_urls: string[];
  payment_return_url: string | null;
  slug_check_rpc: 'slug_available' | null;
  legacy?: boolean;
};

function safeReturnUrl(product: Product): string | null {
  const value = product.payment_return_url;
  if (!value || !product.allowed_return_urls.includes(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash ? value : null;
  } catch {
    return null;
  }
}

async function resolveProduct(id: string): Promise<Product | null> {
  const result = await rpc<Product>('billing_product_config', { p_product: id });
  if (!result.error) {
    const product = result.data;
    if (!product || product.id !== id || !/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(product.auth_url)) return null;
    // Somente o ambiente local pode sobrescrever o Auth deste produto conhecido.
    if (id === LEGACY_PRODUCT && Deno.env.get('PDP_IDENTITY_URL')) {
      product.auth_url = Deno.env.get('PDP_IDENTITY_URL')!;
      product.auth_publishable_key = Deno.env.get('PDP_IDENTITY_PUBLISHABLE_KEY')!;
    }
    return product;
  }
  // Compatibilidade estrita com o banco legado. Falha de rede/JSON nunca vira fallback.
  if (result.error.code !== 'PGRST202' || id !== LEGACY_PRODUCT) return null;
  return {
    id,
    name: 'Ponto do Pedido',
    legacy: true,
    auth_url: Deno.env.get('PDP_IDENTITY_URL') ?? 'https://qmhtzosfbosgolevnybd.supabase.co',
    auth_publishable_key: Deno.env.get('PDP_IDENTITY_PUBLISHABLE_KEY') ?? 'sb_publishable_sapC0VZk-WmhVx__PB65HQ_N7s0dX_d',
    allowed_return_urls: ['https://pontodopedido.vercel.app/portal'],
    payment_return_url: 'https://pontodopedido.vercel.app/portal',
    slug_check_rpc: 'slug_available',
  };
}

async function productRpc<T>(product: Product, action: string, args: unknown) {
  return product.legacy
    ? rpc<T>(`billing_${action}`, args)
    : rpc<T>('billing_product_call', { p_product: product.id, p_action: action, p_args: args });
}

type Identity = { id: string; email: string; name: string };

async function identify(req: Request, product: Product): Promise<Identity | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const res = await fetch(`${product.auth_url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: product.auth_publishable_key },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; email?: string; user_metadata?: { full_name?: string } };
  if (!user.id || !user.email) return null;
  return { id: user.id, email: user.email, name: user.user_metadata?.full_name ?? '' };
}

async function slugAvailable(slug: string, product: Product): Promise<boolean> {
  if (!product.slug_check_rpc) return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug);
  const res = await fetch(`${product.auth_url}/rest/v1/rpc/${product.slug_check_rpc}`, {
    method: 'POST',
    headers: { apikey: product.auth_publishable_key, 'Content-Type': 'application/json' },
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

  if (
    !req.headers
      .get('authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim()
  ) {
    return fail('AUTH_REQUIRED', 'Sessão expirada. Entre novamente.', 401);
  }
  const productId = body.product_id === undefined ? LEGACY_PRODUCT : String(body.product_id);
  if (!/^[a-z0-9_]{2,50}$/.test(productId)) return fail('INVALID_PRODUCT', 'Produto não autorizado.');
  let product: Product | null;
  let identity: Identity | null;
  try {
    product = await resolveProduct(productId);
    if (!product) return fail('INVALID_PRODUCT', 'Produto não autorizado.');
    identity = await identify(req, product);
  } catch {
    return fail('BILLING_UNAVAILABLE', 'Não foi possível validar a identidade do produto.', 502);
  }
  if (!identity) return fail('AUTH_REQUIRED', 'Sessão expirada. Entre novamente.', 401);

  await rpc('billing_settle_expired', {});

  switch (action) {
    case 'overview':
    case 'entitlements': {
      const { data, error } = await productRpc(product, 'overview', { p_identity: identity.id });
      return error ? failure(error) : json(data);
    }
    case 'subscribe': {
      // Fail closed enquanto o banco remoto não comprovar a política segura.
      // Não mudar activation_mode/payment_provider para contornar essa proteção.
      try {
        const policy = await rpc<{ requires_payment: boolean }>('billing_checkout_policy', {});
        if (policy.error || policy.data?.requires_payment !== true) {
          return fail(
            'PAYMENT_CONFIRMATION_REQUIRED',
            'A contratação está temporariamente indisponível até a confirmação da política de pagamento.',
            503,
          );
        }
      } catch {
        return fail('BILLING_UNAVAILABLE', 'Não foi possível verificar a política de pagamento.', 502);
      }
      const slug = String(body.resource_slug ?? body.restaurant_slug ?? '')
        .trim()
        .toLowerCase();
      if (body.accept_terms !== true) return fail('TERMS_REQUIRED', 'É necessário aceitar os termos.');
      const requestKey = `${identity.id}:${String(body.idempotency_key ?? crypto.randomUUID())}`;
      const previous = await productRpc<{ subscription_id: string; status: string }>(product, 'subscription_result', {
        p_identity: identity.id,
        p_idempotency_key: requestKey,
      });
      if (previous.error) return failure(previous.error);
      if (previous.data) return json(previous.data);
      if (!(await slugAvailable(slug, product))) return fail('SLUG_TAKEN', 'Este endereço não está disponível.');
      const { data, error } = await productRpc(product, 'subscribe', {
        p_identity: identity.id,
        p_email: identity.email,
        p_name: String(body.name ?? identity.name ?? ''),
        p_plan: String(body.plan_code ?? ''),
        p_restaurant_name: String(body.resource_name ?? body.restaurant_name ?? ''),
        p_slug: slug,
        p_user_agent: req.headers.get('user-agent') ?? '',
        p_idempotency_key: requestKey,
      });
      return error ? failure(error) : json(data);
    }
    case 'start_payment': {
      const { data: ctx, error: ctxError } = await productRpc<PaymentContext>(product, 'payment_context', {
        p_identity: identity.id,
        p_subscription: body.subscription_id,
      });
      if (ctxError || !ctx) return failure(ctxError ?? {});
      const backUrl = safeReturnUrl(product);
      if (!backUrl)
        return fail('PAYMENT_RETURN_NOT_CONFIGURED', 'O retorno de pagamento deste produto não está configurado.', 503);
      if (ctx.checkout_url) return json({ checkout_url: ctx.checkout_url });
      const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
      if (!accessToken) return fail('PAYMENT_NOT_CONFIGURED', 'O pagamento online ainda não está configurado.', 503);
      const res = await fetch(`${MP_API}/preapproval`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': ctx.subscription_id,
        },
        body: JSON.stringify(
          buildPreapprovalBody({
            subscriptionId: ctx.subscription_id,
            reason: `${product.name} · plano ${ctx.plan_name} · ${ctx.restaurant_name}`,
            payerEmail: ctx.payer_email,
            amountCents: ctx.amount_cents,
            period: ctx.billing_period,
            backUrl,
          }),
        ),
      });
      const created = (await res.json().catch(() => null)) as { id?: string; init_point?: string } | null;
      if (!res.ok || !created?.id || !created.init_point) {
        return fail('PAYMENT_PROVIDER_ERROR', 'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.', 502);
      }
      const { error: startError } = await productRpc(product, 'payment_started', {
        p_subscription: ctx.subscription_id,
        p_provider_subscription_id: created.id,
        p_checkout_url: created.init_point,
      });
      if (startError) return failure(startError);
      return json({ checkout_url: created.init_point });
    }
    case 'renew': {
      return fail('PAYMENT_REQUIRED', 'A renovação exige confirmação de pagamento.', 409);
    }
    case 'change_plan': {
      return fail('PAYMENT_REQUIRED', 'A alteração do plano exige confirmação de pagamento.', 409);
    }
    case 'cancel':
    case 'undo_cancel': {
      const { data, error } = await productRpc(product, 'cancel', {
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
