import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

function setup(policy: 'safe' | 'missing' | 'network' | 'json' = 'safe', previous = false) {
  let handler!: (req: Request) => Promise<Response>;
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const fetch = vi.fn(async (url: string, options: RequestInit) => {
    const path = new URL(url).pathname;
    const body = options.body ? JSON.parse(String(options.body)) : {};
    calls.push({ path, body });
    if (path.endsWith('/billing_product_config')) return Response.json({ code: 'PGRST202' }, { status: 404 });
    if (path === '/auth/v1/user') return Response.json({ id: 'owner-a', email: 'unit@local.invalid' });
    if (path.endsWith('/billing_checkout_policy')) {
      if (policy === 'network') throw new Error('network');
      if (policy === 'json') return new Response('invalid');
      if (policy === 'missing') return Response.json({ code: 'PGRST202' }, { status: 404 });
      return Response.json({ requires_payment: true });
    }
    if (path.endsWith('/billing_subscription_result'))
      return Response.json(previous ? { subscription_id: 'existing', status: 'pending_payment' } : null);
    if (path.endsWith('/slug_available')) return Response.json(!previous);
    if (path.endsWith('/billing_subscribe')) return Response.json({ subscription_id: 'created', status: 'pending_payment' });
    return Response.json(null);
  });
  const compiled = ts.transpileModule(readFileSync('backend/billing/supabase/functions/billing/index.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(compiled, {
    exports: {},
    require: () => ({}),
    fetch,
    Response,
    crypto,
    Deno: {
      env: { get: (key: string) => ({ SUPABASE_URL: 'https://billing.test', SUPABASE_SERVICE_ROLE_KEY: 'unit-only' })[key] },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
  });
  const call = (action = 'subscribe', token: string | null = 'unit-session') =>
    handler(
      new Request('https://billing.test/functions/v1/billing', {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({
          action,
          restaurant_slug: 'restaurant',
          accept_terms: true,
          idempotency_key: 'request',
          plan_code: 'start',
          price_cents: 1,
          identity: 'owner-b',
        }),
      }),
    );
  return { call, calls };
}

describe('proteção comercial do billing', () => {
  it.each(['missing', 'network', 'json'] as const)('não contrata sem comprovar política segura: %s', async (policy) => {
    const s = setup(policy);
    expect((await s.call()).status).toBe(policy === 'missing' ? 503 : 502);
    expect(s.calls.some((c) => c.path.endsWith('/billing_subscribe'))).toBe(false);
  });
  it('usa somente a identidade validada e deixa o preço para a RPC', async () => {
    const s = setup();
    expect(await (await s.call()).json()).toEqual({ subscription_id: 'created', status: 'pending_payment' });
    const args = s.calls.find((c) => c.path.endsWith('/billing_subscribe'))!.body;
    expect(args.p_identity).toBe('owner-a');
    expect(args).not.toHaveProperty('price_cents');
  });
  it('recupera resultado idempotente antes de rejeitar endereço já provisionado', async () => {
    const s = setup('safe', true);
    expect(await (await s.call()).json()).toEqual({ subscription_id: 'existing', status: 'pending_payment' });
    expect(s.calls.some((c) => c.path.endsWith('/slug_available') || c.path.endsWith('/billing_subscribe'))).toBe(false);
  });
  it.each(['renew', 'change_plan'])('%s não altera período nem módulos sem pagamento', async (action) => {
    const s = setup();
    expect((await s.call(action)).status).toBe(409);
    expect(s.calls.some((c) => c.path.endsWith(`/billing_${action}`))).toBe(false);
  });
  it('nega contratação sem sessão antes de consultar política', async () => {
    const s = setup();
    expect((await s.call('subscribe', null)).status).toBe(401);
    expect(s.calls).toEqual([]);
  });
});
