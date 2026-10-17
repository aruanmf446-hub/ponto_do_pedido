'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SchemeToggle } from '@/core/ui/SchemeToggle';

/**
 * O App Router conserva layouts entre navegações. As rotas privadas só são
 * renderizadas para usuários autenticados, mesmo quando a informação do
 * cabeçalho do layout ainda está desatualizada depois de entrar.
 */
export function PlatformNav({ signedIn, portal = false }: { signedIn: boolean; portal?: boolean }) {
  const pathname = usePathname();
  const privateRoute = pathname === '/portal' || pathname.startsWith('/portal/') || pathname === '/contratar';
  const loggedIn = signedIn || privateRoute;

  return (
    <nav className="pl-nav" aria-label="Principal">
      {!portal && (
        <>
          <Link href="/#aplicativos">Aplicativos</Link>
          <Link href="/planos">Planos</Link>
        </>
      )}
      {loggedIn ? (
        <Link href="/portal" className="pl-nav-strong">Minha conta</Link>
      ) : (
        <>
          <Link href="/entrar">Entrar</Link>
          <Link href="/planos" className="pl-btn pl-btn--small">Nossos planos</Link>
        </>
      )}
      <SchemeToggle className="pl-scheme" />
    </nav>
  );
}
