import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

function setup(env: Record<string, string> = {}) {
  const fetch = vi.fn();
  const exports = {} as { integrationConfigured: () => boolean; adminRpc: (name: string, args: unknown) => Promise<unknown> };
  const source = ts.transpileModule(readFileSync('backend/app/supabase/functions/_shared/http.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(source, { exports, fetch, Response, console, Deno: { env: { get: (key: string) => env[key] } } });
  return { exports, fetch };
}
const configured = {
  SUPABASE_URL: 'https://app.unit',
  SUPABASE_SERVICE_ROLE_KEY: 'unit-service',
  SUPABASE_ANON_KEY: 'unit-public',
};
describe('proteções preservadas da função manual', () => {
  it('configuração ausente é identificada sem iniciar requisições', () => {
    const s = setup();
    expect(s.exports.integrationConfigured()).toBe(false);
    expect(s.fetch).not.toHaveBeenCalled();
  });
  it('JSON inválido das chaves usa a chave legada disponível', async () => {
    const s = setup({ ...configured, SUPABASE_SECRET_KEYS: '{invalid', SUPABASE_PUBLISHABLE_KEYS: '{invalid' });
    expect(s.exports.integrationConfigured()).toBe(true);
    s.fetch.mockResolvedValue(Response.json('tenant'));
    expect(await s.exports.adminRpc('admin_sync_license', {})).toEqual({ data: 'tenant', error: null });
  });
  it.each(['network', 'json'])('RPC operacional trata %s sem expor detalhes', async (failure) => {
    const s = setup(configured);
    if (failure === 'network') s.fetch.mockRejectedValue(Error('detail must not escape'));
    else s.fetch.mockResolvedValue(new Response('invalid JSON'));
    expect(await s.exports.adminRpc('admin_sync_license', {})).toEqual({
      data: null,
      error: { message: 'Falha ao consultar o banco operacional.' },
    });
  });
});
