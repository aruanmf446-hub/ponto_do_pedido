import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

function setup() {
  const fetch = vi.fn();
  const exports = {} as {
    fetchPlans: () => Promise<unknown>;
    billingCall: (action: string, payload: Record<string, unknown>) => Promise<unknown>;
  };
  const compiled = ts.transpileModule(readFileSync('src/core/billing.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(compiled, {
    exports,
    fetch,
    require: (name: string) => {
      if (name === '@/core/config') return { config: { billing: { url: 'https://billing.unit', publishableKey: 'unit-only' } } };
      if (name === '@/core/supabase/server') return { getAccessToken: async () => 'unit-session' };
      if (name === '@/core/errors') return { ok: (v: unknown) => v, failure: (code: string) => ({ code }) };
      return {};
    },
  });
  return { fetch, exports };
}

describe('cliente comercial do Ponto do Pedido', () => {
  it('consulta somente catálogo do próprio produto', async () => {
    const s = setup();
    s.fetch.mockResolvedValue(Response.json([{ code: 'start', product_id: 'ponto_do_pedido' }]));
    expect(await s.exports.fetchPlans()).toEqual([{ code: 'start', product_id: 'ponto_do_pedido' }]);
    expect(s.fetch.mock.calls[0]![0]).toContain('product_id=eq.ponto_do_pedido');
  });
  it('catálogo legado só é consultado se product_id ainda não existe', async () => {
    const s = setup();
    s.fetch
      .mockResolvedValueOnce(Response.json({ code: '42703' }, { status: 400 }))
      .mockResolvedValueOnce(Response.json([{ code: 'start' }]));
    expect(await s.exports.fetchPlans()).toEqual([{ code: 'start' }]);
    expect(s.fetch).toHaveBeenCalledTimes(2);
  });
  it.each([400, 404, 503])('outro erro %s não remove filtro de produto', async (status) => {
    const s = setup();
    s.fetch.mockResolvedValue(Response.json({ code: 'OTHER' }, { status }));
    expect(await s.exports.fetchPlans()).toEqual([]);
    expect(s.fetch).toHaveBeenCalledTimes(1);
  });
  it('payload não sobrescreve produto nem ação definidos pelo servidor', async () => {
    const s = setup();
    s.fetch.mockResolvedValue(Response.json({ subscriptions: [] }));
    await s.exports.billingCall('overview', { product_id: 'oficina_unit', action: 'subscribe' });
    expect(JSON.parse(s.fetch.mock.calls[0]![1].body)).toEqual({ product_id: 'ponto_do_pedido', action: 'overview' });
  });
});
