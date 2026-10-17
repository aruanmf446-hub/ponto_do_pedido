import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/core/config', () => ({ config: { app: { url: 'https://qmhtzosfbosgolevnybd.supabase.co' } } }));
vi.mock('@/core/supabase/server', () => ({ createServerSupabase: vi.fn() }));
import { recentRecoveryClaims } from '@/core/auth/recovery';
const claims = {
  sub: 'owner',
  session_id: 'session',
  iss: 'https://qmhtzosfbosgolevnybd.supabase.co/auth/v1',
  exp: 11000,
  amr: [{ method: 'recovery', timestamp: 9900 }],
};
it('aceita somente recuperação recente do próprio usuário e projeto', () => {
  expect(recentRecoveryClaims(claims, 'owner', 10000)).toBe(true);
  for (const override of [
    { sub: 'other' },
    { iss: 'https://bjtlookhgkdltdohzxnq.supabase.co/auth/v1' },
    { session_id: undefined },
    { exp: 9999 },
    { amr: [{ method: 'password', timestamp: 9900 }] },
    { amr: [{ method: 'recovery', timestamp: 1 }] },
    { amr: [null] },
  ])
    expect(recentRecoveryClaims({ ...claims, ...override }, 'owner', 10000)).toBe(false);
});
