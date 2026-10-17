'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { browserSupabase } from '@/core/supabase/browser';
import { SchemeToggle } from '@/core/ui/SchemeToggle';

/**
 * O layout do App Router permanece montado durante navegações.
 * Acompanhar o Auth evita mostrar "Entrar" depois de uma autenticação.
 */
export function PlatformNav({ signedIn, portal = false }: { signedIn: boolean; portal?: boolean }) {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(signedIn);

  useEffect(() => {
    let mounted = true;
    const client = browserSupabase();
    void client.auth.getUser()
      .then(({ data }) => {
        if (mounted) setAuthenticated(Boolean(data.user));
      })
      .catch(() => { /* Estado da sessão será confirmado no servidor das páginas protegidas. */ });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (mounted) setAuthenticated(Boolean(session?.user));
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Páginas que exigem sessão nunca devem exibir a ação de entrar, mesmo
  // se o layout persistente ainda tiver a informação anterior ao login.
  const protectedRoute = pathname === '/portal' || pathname.startsWith('/portal/') || pathname === '/contratar';
  const loggedIn = authenticated || protectedRoute;

  return (
    <nav className="pl-nav" aria-label="Principal">
      {!portal && (
        <>
          <Link href="/#aplicativos">Aplicativos</Link>
          <Link href="/planos">Planos</Link>
        </>
      )}
      {loggedIn ? (
        <Link href="/portal" className="pl-nav-strong">
          Minha conta
        </Link>
      ) : (
        <>
          <Link href="/entrar">Entrar</Link>
          <Link href="/planos" className="pl-btn pl-btn--small">
            Nossos planos
          </Link>
        </>
      )}
      <SchemeToggle className="pl-scheme" />
    </nav>
  );
}
