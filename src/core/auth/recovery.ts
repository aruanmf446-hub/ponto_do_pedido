import 'server-only';
import { config } from '@/core/config';
import { createServerSupabase } from '@/core/supabase/server';

/** Somente claims verificadas pelo Auth/SDK. Nunca ler amr de JWT decodificado pelo cliente. */
export function recentRecoveryClaims(value: unknown, userId: string, now = Date.now() / 1000): boolean {
  if (!value || typeof value !== 'object') return false;
  const claims = value as Record<string, unknown>;
  return (
    claims.sub === userId &&
    claims.iss === `${config.app.url}/auth/v1` &&
    typeof claims.session_id === 'string' &&
    typeof claims.exp === 'number' &&
    claims.exp > now &&
    Array.isArray(claims.amr) &&
    claims.amr.some(
      (entry: { method?: string; timestamp?: number }) =>
        entry &&
        typeof entry === 'object' &&
        entry.method === 'recovery' &&
        typeof entry.timestamp === 'number' &&
        entry.timestamp <= now + 30 &&
        now - entry.timestamp < 3600,
    )
  );
}

export async function recoveryUser() {
  const supabase = await createServerSupabase();
  try {
    const { data: user, error } = await supabase.auth.getUser();
    if (error || !user.user) return null;
    const { data, error: claimsError } = await supabase.auth.getClaims();
    return !claimsError && recentRecoveryClaims(data?.claims, user.user.id) ? user.user : null;
  } catch {
    return null;
  }
}
