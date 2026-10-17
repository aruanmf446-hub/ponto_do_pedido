import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: 'pontodopedido.vercel.app' }) }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(target);
  }),
}));
vi.mock('@/core/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('@/core/auth/recovery', () => ({ recoveryUser: vi.fn() }));
import { createServerSupabase } from '@/core/supabase/server';
import { recoveryUser } from '@/core/auth/recovery';
import { requestEmailChange, requestPasswordRecovery, saveRecoveredPassword } from '@/apps/plataforma/security-actions';
const auth = {
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
};
const form = (values: Record<string, string>) => {
  const f = new FormData();
  Object.entries(values).forEach(([k, v]) => f.set(k, v));
  return f;
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createServerSupabase).mockResolvedValue({ auth } as never);
});
it('recuperação não distingue usuário existente, inexistente e limitação de envio', async () => {
  const results = [];
  for (const error of [null, { code: 'user_not_found' }, { code: 'over_email_send_rate_limit' }]) {
    auth.resetPasswordForEmail.mockResolvedValue({ error });
    results.push(await requestPasswordRecovery(null, form({ email: 'unit@local.invalid' })));
  }
  expect(results[0]).toEqual(results[1]);
  expect(results[1]).toEqual(results[2]);
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('unit@local.invalid', {
    redirectTo: 'https://pontodopedido.vercel.app/auth/recuperar',
  });
});
it('sem sessão de recuperação não altera senha', async () => {
  vi.mocked(recoveryUser).mockResolvedValue(null);
  expect(await saveRecoveredPassword(null, form({ password: 'Unit-password-1', confirmation: 'Unit-password-1' }))).toMatchObject(
    { code: 'RECOVERY_REQUIRED' },
  );
  expect(auth.updateUser).not.toHaveBeenCalled();
});
it('valida confirmação e comprimento antes da alteração', async () => {
  expect(await saveRecoveredPassword(null, form({ password: 'short', confirmation: 'short' }))).toMatchObject({
    code: 'INVALID',
  });
  expect(await saveRecoveredPassword(null, form({ password: 'Unit-password-1', confirmation: 'different' }))).toMatchObject({
    code: 'INVALID',
  });
  expect(auth.updateUser).not.toHaveBeenCalled();
});
it('recuperação válida atualiza senha, encerra sessão e retorna ao login', async () => {
  vi.mocked(recoveryUser).mockResolvedValue({ id: 'owner' } as never);
  auth.updateUser.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
  await expect(
    saveRecoveredPassword(null, form({ password: 'Unit-password-1', confirmation: 'Unit-password-1' })),
  ).rejects.toThrow('/entrar?senha=alterada');
  expect(auth.signOut).toHaveBeenCalled();
});
it('alteração de e-mail exige sessão e reautenticação do usuário atual', async () => {
  auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect(await requestEmailChange(null, form({ email: 'new@local.invalid', password: 'unit' }))).toMatchObject({
    code: 'AUTH_REQUIRED',
  });
  expect(auth.updateUser).not.toHaveBeenCalled();
  auth.getUser.mockResolvedValue({ data: { user: { id: 'owner', email: 'old@local.invalid' } }, error: null });
  auth.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials' } });
  expect(await requestEmailChange(null, form({ email: 'new@local.invalid', password: 'unit' }))).toMatchObject({
    code: 'AUTH_FAILED',
  });
  expect(auth.updateUser).not.toHaveBeenCalled();
});
it('e-mail pendente não é anunciado como alterado e não enumera alvo existente', async () => {
  auth.getUser.mockResolvedValue({ data: { user: { id: 'owner', email: 'old@local.invalid' } }, error: null });
  auth.signInWithPassword.mockResolvedValue({ error: null });
  auth.updateUser.mockResolvedValue({ error: null });
  const a = await requestEmailChange(null, form({ email: 'new@local.invalid', password: 'unit' }));
  auth.updateUser.mockResolvedValue({ error: { code: 'email_exists' } });
  const b = await requestEmailChange(null, form({ email: 'new@local.invalid', password: 'unit' }));
  expect(a).toEqual(b);
  expect(a).toMatchObject({ ok: true });
  expect(auth.updateUser).toHaveBeenCalledWith(
    { email: 'new@local.invalid' },
    { emailRedirectTo: 'https://pontodopedido.vercel.app/auth/confirm?flow=email-change&next=/portal/seguranca' },
  );
});
