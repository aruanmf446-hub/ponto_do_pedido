import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { safeAuthNext } from '@/core/auth/redirect';

vi.mock('@/core/supabase/server', () => ({ createServerSupabase: vi.fn() }));
import { createServerSupabase } from '@/core/supabase/server';
import { confirmEmail } from '@/core/auth/confirm';

const exchange = vi.fn();
const verify = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createServerSupabase).mockResolvedValue({
    auth: { exchangeCodeForSession: exchange, verifyOtp: verify },
  } as unknown as Awaited<ReturnType<typeof createServerSupabase>>);
});

it.each(['https://evil.invalid', '//evil.invalid', '/\\evil.invalid', '/\n/evil.invalid'])(
  'recusa redirecionamento externo: %j',
  (path) => {
    expect(safeAuthNext(path, '/portal')).toBe('/portal');
  },
);

it('confirmação válida segue para a contratação no domínio da aplicação', async () => {
  verify.mockResolvedValue({ error: null });
  const response = await confirmEmail(
    new NextRequest('https://pontodopedido.vercel.app/auth/confirm?token_hash=unit-hash&type=email&next=/contratar'),
  );
  expect(response.headers.get('location')).toBe('https://pontodopedido.vercel.app/contratar');
  expect(verify).toHaveBeenCalledWith({ token_hash: 'unit-hash', type: 'email' });
});

it('código válido com verifier segue para o Portal', async () => {
  exchange.mockResolvedValue({ error: null });
  const response = await confirmEmail(
    new NextRequest('https://pontodopedido.vercel.app/auth/confirm?code=unit-code&next=/portal'),
  );
  expect(response.headers.get('location')).toBe('https://pontodopedido.vercel.app/portal');
});

it('código sem verifier oferece login sem criar sessão nem expor código', async () => {
  exchange.mockResolvedValue({ error: { code: 'flow_state_not_found' } });
  const response = await confirmEmail(
    new NextRequest('https://pontodopedido.vercel.app/auth/confirm?code=unit-code&next=/contratar'),
  );
  const location = new URL(response.headers.get('location')!);
  expect(location.pathname).toBe('/entrar');
  expect(location.searchParams.get('next')).toBe('/contratar');
  expect(location.searchParams.get('confirmacao')).toBe('continuar');
  expect(location.searchParams.has('code')).toBe(false);
  expect(verify).not.toHaveBeenCalled();
});

it('hash inválido não autoriza o Portal', async () => {
  verify.mockResolvedValue({ error: { code: 'otp_expired' } });
  const response = await confirmEmail(
    new NextRequest('https://pontodopedido.vercel.app/auth/confirm?token_hash=invalid&type=email&next=//evil.invalid'),
  );
  expect(response.headers.get('location')).toBe('https://pontodopedido.vercel.app/?erro=link-invalido');
});
