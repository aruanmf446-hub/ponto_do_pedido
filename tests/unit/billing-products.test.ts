import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Produtos e tokens sintéticos existem apenas neste teste unitário.
function setup(
  options: { registry?: 'network' | 'missing' | 'json'; returnUrl?: string; paymentEnabled?: boolean; allowed?: string[] } = {},
) {
  let handler!: (r: Request) => Promise<Response>;
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const products = {
    ponto_do_pedido: { name: 'Ponto do Pedido', ref: 'qmhtzosfbosgolevnybd' },
    oficina_unit: { name: 'Oficina unitária', ref: 'abcdefghijklmnopqrst' },
  };
  const source = ts.transpileModule(readFileSync('backend/billing/supabase/functions/billing/index.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(source, {
    exports: {},
    URL,
    Response,
    crypto,
    require: () => ({ MP_API: 'https://payment.unit', buildPreapprovalBody: (body: unknown) => body }),
    fetch: async (url: string, init: RequestInit) => {
      const body = init.body ? JSON.parse(String(init.body)) : {};
      calls.push({ url, body });
      if (url.endsWith('/billing_product_config')) {
        if (options.registry === 'network') throw Error('network');
        if (options.registry === 'json') return new Response('invalid JSON');
        if (options.registry === 'missing') return Response.json({ code: 'PGRST202' }, { status: 404 });
        const id = body.p_product as keyof typeof products;
        const p = products[id];
        return Response.json(
          p
            ? {
                id,
                name: p.name,
                auth_url: `https://${p.ref}.supabase.co`,
                auth_publishable_key: 'unit-public-key',
                payment_return_url: options.returnUrl ?? 'https://oficina.unit/portal',
                allowed_return_urls: options.allowed ?? ['https://oficina.unit/portal'],
                slug_check_rpc: null,
              }
            : null,
        );
      }
      if (url.endsWith('/auth/v1/user')) {
        const token = (init.headers as Record<string, string>).Authorization;
        const accepted = url.includes(products.oficina_unit.ref) ? 'Bearer oficina-token' : 'Bearer pdp-token';
        return token === accepted
          ? Response.json({ id: 'same-uuid', email: 'unit@local.invalid' })
          : Response.json({}, { status: 401 });
      }
      if (url.endsWith('/billing_checkout_policy')) return Response.json({ requires_payment: options.paymentEnabled !== false });
      if (url.endsWith('/billing_payment_provider')) return Response.json('mercadopago');
      if (url.endsWith('/billing_product_call')) {
        if (body.p_action === 'payment_context')
          return Response.json({
            subscription_id: 'sub',
            plan_name: 'Plano',
            amount_cents: 4999,
            restaurant_name: 'Empresa',
            payer_email: 'unit@local.invalid',
          });
        return Response.json({ product_id: body.p_product, subscriptions: [] });
      }
      if (url === 'https://payment.unit/preapproval')
        return Response.json({ id: 'provider-id', init_point: 'https://payment.unit/checkout' });
      return Response.json(null);
    },
    Deno: {
      env: {
        get: (key: string) =>
          ({ SUPABASE_URL: 'https://billing.unit', SUPABASE_SERVICE_ROLE_KEY: 'unit-only', MP_ACCESS_TOKEN: 'unit-only' })[key],
      },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
  });
  const call = (product = 'oficina_unit', token = 'oficina-token', action = 'overview') =>
    handler(
      new Request('https://billing.unit', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action,
          product_id: product,
          identity: 'another-user',
          auth_url: 'https://attacker.unit',
          back_url: 'https://attacker.unit',
          subscription_id: 'sub',
        }),
      }),
    );
  return { call, calls };
}

describe('billing central por produto', () => {
  it('valida no Auth cadastrado e passa somente identidade validada ao gateway', async () => {
    const s = setup();
    expect(await (await s.call()).json()).toEqual({ product_id: 'oficina_unit', subscriptions: [] });
    const args = s.calls.find((c) => c.url.endsWith('/billing_product_call'))!.body;
    expect(args).toEqual({ p_product: 'oficina_unit', p_action: 'overview', p_args: { p_identity: 'same-uuid' } });
    expect(s.calls.some((c) => c.url.includes('attacker'))).toBe(false);
  });
  it.each([
    ['oficina_unit', 'pdp-token'],
    ['ponto_do_pedido', 'oficina-token'],
  ])('token de outro Auth não entra em %s', async (product, token) => {
    const s = setup();
    expect((await s.call(product, token)).status).toBe(401);
    expect(s.calls.some((c) => c.url.endsWith('/billing_product_call'))).toBe(false);
  });
  it('não consulta URL fornecida pelo navegador nem aceita produto inexistente', async () => {
    const s = setup();
    expect((await s.call('unknown_product')).status).toBe(400);
    expect(s.calls.some((c) => c.url.endsWith('/auth/v1/user'))).toBe(false);
  });
  it.each(['network', 'json'] as const)('falha de cadastro %s não retorna ao Auth legado', async (registry) => {
    const s = setup({ registry });
    expect((await s.call('ponto_do_pedido', 'pdp-token')).status).toBe(502);
    expect(s.calls.some((c) => c.url.endsWith('/auth/v1/user'))).toBe(false);
  });
  it('banco legado não habilita outros produtos', async () => {
    const s = setup({ registry: 'missing' });
    expect((await s.call()).status).toBe(400);
  });
  it('envia ao provedor somente retorno autorizado para o produto, ignorando o navegador', async () => {
    const s = setup();
    expect((await s.call('oficina_unit', 'oficina-token', 'start_payment')).status).toBe(200);
    const payment = s.calls.find((c) => c.url === 'https://payment.unit/preapproval')!.body;
    expect(payment.backUrl).toBe('https://oficina.unit/portal');
    expect(payment.reason).toContain('Oficina unitária');
  });
  it.each([
    { returnUrl: 'https://attacker.unit' },
    { returnUrl: 'javascript:alert(1)', allowed: ['javascript:alert(1)'] },
    { returnUrl: 'https://user:password@oficina.unit', allowed: ['https://user:password@oficina.unit'] },
  ])('bloqueia retorno inseguro antes de chamar o provedor: $returnUrl', async (options) => {
    const s = setup(options);
    const res = await s.call('oficina_unit', 'oficina-token', 'start_payment');
    expect(res.status).toBe(503);
    expect(s.calls.some((c) => c.url === 'https://payment.unit/preapproval')).toBe(false);
  });
});

it('prontidão exige migração multiproduto, política segura e configuração de pagamento', async () => {
  for (const options of [
    {},
    { registry: 'missing' as const },
    { paymentEnabled: false },
    { returnUrl: 'https://attacker.unit' },
  ]) {
    const s = setup(options);
    const legacy = options.registry === 'missing';
    const res = await s.call(
      legacy ? 'ponto_do_pedido' : 'oficina_unit',
      legacy ? 'pdp-token' : 'oficina-token',
      'checkout_status',
    );
    expect(await res.json()).toEqual({ available: Object.keys(options).length === 0 });
    expect(s.calls.some((c) => c.url.includes('payment.unit/preapproval') || c.body.p_action === 'subscribe')).toBe(false);
  }
});
