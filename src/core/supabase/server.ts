import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { assertConfigured, config } from '@/core/config';
import { withCookieDomain } from '@/core/supabase/cookies';

/** Cliente Supabase do projeto operacional com a sessão do usuário (RLS). */
export async function createServerSupabase() {
  assertConfigured();
  const cookieStore = await cookies();
  const host = (await headers()).get('host');
  return createServerClient(config.app.url, config.app.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, withCookieDomain(options, host));
        } catch {
          // Componentes de servidor não podem gravar cookies; o proxy renova a sessão.
        }
      },
    },
  });
}

/** Usuário autenticado validado no Auth (não confia apenas no cookie). */
export const getCurrentUser = cache(async () => {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

/** Token de acesso atual, para chamar Edge Functions em nome do usuário. */
export const getAccessToken = cache(async (): Promise<string | null> => {
  const supabase = await createServerSupabase();
  // Este token não é usado como prova de identidade aqui. As Edge Functions
  // sempre o validam no Auth oficial; evita uma chamada extra getUser a cada RPC.
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
});
