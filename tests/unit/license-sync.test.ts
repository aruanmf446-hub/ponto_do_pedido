import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Executa o handler real, sem depender do runtime Deno nos testes unitários.
function setup() {
  let handler!: (request: Request) => Promise<Response>;
  const rpc = vi.fn().mockResolvedValue({ data: 'tenant-id', error: null });
  const currentUser = vi.fn().mockResolvedValue({ id: 'owner-a' });
  const fetch = vi.fn();
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const shared = {
    adminRpc: rpc,
    integrationConfigured: () => true,
    currentUser,
    cors: {},
    json,
    bearer: (req: Request) => req.headers.get('authorization'),
    fail: (code: string, message: string, status = 400) => json({ error: { code, message } }, status),
  };
  const source = readFileSync('backend/app/supabase/functions/license-sync/index.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(compiled, {
    exports: {},
    require: () => shared,
    fetch,
    Response,
    console,
    Deno: {
      env: { get: () => 'unit-public-key' },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
  });
  const call = (token: string | null = 'valid-session') =>
    handler(
      new Request('https://app/license-sync', {
        method: 'POST',
        headers: token ? { authorization: token } : {},
        body: JSON.stringify({ owner: 'owner-b', plan_code: 'diamond', modules: ['estoque'] }),
      }),
    );
  return { call, rpc, currentUser, fetch };
}

describe('license-sync: fronteiras de confiança e falhas do billing', () => {
  it('nega sessão ausente ou rejeitada antes de consultar assinaturas', async () => {
    const s = setup();
    expect((await s.call(null)).status).toBe(401);
    s.currentUser.mockResolvedValue(null);
    expect((await s.call('invalid')).status).toBe(401);
    expect(s.fetch).not.toHaveBeenCalled();
    expect(s.rpc).not.toHaveBeenCalled();
  });

  it.each(['network', 'http', 'json', 'shape'])('não provisiona quando billing falha: %s', async (failure) => {
    const s = setup();
    if (failure === 'network') s.fetch.mockRejectedValue(new Error('network down'));
    else
      s.fetch.mockResolvedValue(new Response(failure === 'json' ? 'invalid' : '{}', { status: failure === 'http' ? 503 : 200 }));
    const response = await s.call();
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe('BILLING_UNAVAILABLE');
    expect(s.rpc).not.toHaveBeenCalled();
  });

  it('não libera assinatura pendente', async () => {
    const s = setup();
    s.fetch.mockResolvedValue(Response.json({ subscriptions: [{ status: 'pending_payment', restaurant_slug: 'pending' }] }));
    expect((await s.call()).status).toBe(200);
    expect(s.rpc).not.toHaveBeenCalled();
  });

  it.each(['active', 'suspended', 'cancelled'])('usa identidade validada e dados oficiais para %s', async (status) => {
    const s = setup();
    s.fetch.mockResolvedValue(
      Response.json({
        subscriptions: [
          {
            id: 'subscription-a',
            plan_code: 'start',
            modules: ['gestao'],
            status,
            restaurant_slug: 'restaurant-a',
            restaurant_name: 'A',
            current_period_end: null,
          },
        ],
      }),
    );
    await s.call();
    expect(s.rpc).toHaveBeenCalledWith(
      'admin_sync_license',
      expect.objectContaining({
        p_owner: 'owner-a',
        p_subscription_id: 'subscription-a',
        p_status: status,
        p_plan_code: 'start',
        p_modules: ['gestao'],
      }),
    );
  });
});

it('não sincroniza licenças retornadas para outro produto', async () => {
  const s = setup();
  s.fetch.mockResolvedValue(Response.json({ product_id: 'oficina_unit', subscriptions: [] }));
  expect((await s.call()).status).toBe(502);
  expect(s.rpc).not.toHaveBeenCalled();
});
it('não sincroniza assinatura de outro produto mesmo dentro de resposta do Ponto do Pedido', async () => {
  const s = setup();
  s.fetch.mockResolvedValue(
    Response.json({ product_id: 'ponto_do_pedido', subscriptions: [{ product_id: 'oficina_unit', status: 'active' }] }),
  );
  expect((await s.call()).status).toBe(502);
  expect(s.rpc).not.toHaveBeenCalled();
});
