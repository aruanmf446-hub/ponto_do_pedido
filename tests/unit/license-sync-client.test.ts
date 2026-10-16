import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/core/supabase/server', () => ({ getAccessToken: vi.fn(async () => 'session') }));
vi.mock('@/core/config', () => ({ config: { app: { url: 'https://app.example', publishableKey: 'public' } } }));

import { syncLicenses } from '@/core/billing';

describe('resposta da sincronização no frontend', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it.each([null, {}, { error: { code: 'RPC_ERROR', message: 'Falha' } }])(
    'rejeita resposta de sucesso inválida: %j',
    async (body) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json(body)),
      );
      expect((await syncLicenses()).ok).toBe(false);
    },
  );

  it('preserva erros individuais para a ação informar ao usuário', async () => {
    const body = { results: [{ slug: 'restaurant', error: 'Falha ao sincronizar' }] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(body)),
    );
    expect(await syncLicenses()).toEqual({ ok: true, data: body });
  });
});
