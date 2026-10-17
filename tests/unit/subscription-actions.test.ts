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

import { headers } from 'next/headers';
import { createServerSupabase } from '@/core/supabase/server';
import { billingCall, syncLicenses } from '@/core/billing';
import { refreshLicenses, signUpSubscriber, subscribe, subscriptionAction } from '@/apps/plataforma/actions';

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

it('cadastro novo e erro de e-mail existente devolvem a mesma orientação neutra', async () => {
  vi.mocked(headers).mockResolvedValue(new Headers({ host: 'pontodopedido.vercel.app' }) as never);
  const signUp = vi.fn();
  vi.mocked(createServerSupabase).mockResolvedValue({ auth: { signUp } } as never);
  const form = new FormData();
  for (const [k, v] of Object.entries({ name: 'Local test', email: 'unit@local.invalid', password: 'Unit-password-1' }))
    form.set(k, v);
  signUp.mockResolvedValue({ data: { session: null }, error: null });
  const a = await signUpSubscriber(null, form);
  signUp.mockResolvedValue({ data: { session: null }, error: { code: 'user_already_exists', message: 'already registered' } });
  const b = await signUpSubscriber(null, form);
  expect(a).toEqual(b);
  expect(a).toMatchObject({ ok: true, confirm: true });
});
