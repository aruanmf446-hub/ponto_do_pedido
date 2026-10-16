import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('redirect');
  }),
}));
vi.mock('@/core/billing', () => ({ billingCall: vi.fn(), syncLicenses: vi.fn() }));
vi.mock('@/core/rpc', () => ({ rpc: vi.fn() }));
vi.mock('@/core/supabase/server', () => ({ createServerSupabase: vi.fn() }));

import { billingCall, syncLicenses } from '@/core/billing';
import { refreshLicenses, subscribe, subscriptionAction } from '@/apps/plataforma/actions';

describe('ações comerciais não ocultam falhas da licença', () => {
  beforeEach(() => vi.resetAllMocks());

  it('não redireciona para boas-vindas quando a resposta não contém o restaurante', async () => {
    vi.mocked(billingCall).mockResolvedValue({ ok: true, data: { status: 'active', subscription_id: 'sub' } });
    vi.mocked(syncLicenses).mockResolvedValue({ ok: true, data: { results: [] } });
    const form = new FormData();
    for (const [key, value] of Object.entries({
      plan: 'start',
      restaurant: 'Teste',
      slug: 'restaurante',
      terms: 'on',
      key: '12345678',
    }))
      form.set(key, value);
    expect(await subscribe(null, form)).toMatchObject({ ok: false, code: 'SYNC_ERROR' });
  });

  it('informa erro individual ao atualizar e ao executar operação comercial', async () => {
    vi.mocked(billingCall).mockResolvedValue({ ok: true, data: null });
    vi.mocked(syncLicenses).mockResolvedValue({ ok: true, data: { results: [{ slug: 'restaurant', error: 'Falha no RPC' }] } });
    expect(await refreshLicenses()).toMatchObject({ ok: false, code: 'SYNC_ERROR', message: 'Falha no RPC' });
    expect(await subscriptionAction('cancel', 'sub')).toMatchObject({ ok: false, code: 'SYNC_ERROR' });
  });
});
