import Link from 'next/link';
import type { ReactNode } from 'react';
import { DEVELOPER } from '@/core/config';
import { SchemeToggle } from '@/core/ui/SchemeToggle';
import { display, editorial, sora, text } from '@/apps/plataforma/fonts';
import '@/apps/plataforma/plataforma.css';

export function PlatformMark() {
  return (
    <Link href="/" className="pl-mark" aria-label="Ponto do Pedido — início">
      <span className="pl-mark-dot" aria-hidden="true" />
      Ponto do Pedido
    </Link>
  );
}

/** Estrutura do site institucional e do portal (claro/escuro). */
export function PlatformChrome({ children, signedIn, portal }: { children: ReactNode; signedIn: boolean; portal?: boolean }) {
  return (
    <div className={`pl ${display.variable} ${text.variable} ${editorial.variable} ${sora.variable}`}>
      <a className="pl-skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="pl-header">
        <PlatformMark />
        <nav className="pl-nav" aria-label="Principal">
          {portal ? null : (
            <>
              <Link href="/#aplicativos">Aplicativos</Link>
              <Link href="/planos">Planos</Link>
            </>
          )}
          {signedIn ? (
            <Link href="/portal" className="pl-nav-strong">
              Portal do Assinante
            </Link>
          ) : (
            <>
              <Link href="/entrar">Entrar</Link>
              <Link href="/planos" className="pl-btn pl-btn--small">
                Assinar
              </Link>
            </>
          )}
          <SchemeToggle className="pl-scheme" />
        </nav>
      </header>
      <main id="conteudo" className="pl-main">
        {children}
      </main>
      <footer className="pl-footer">
        <div>
          <PlatformMark />
          <p>Gestão para restaurantes com aplicativos independentes.</p>
        </div>
        <nav aria-label="Rodapé" className="pl-footer-links">
          <Link href="/planos">Planos</Link>
          <Link href="/termos">Termos de uso</Link>
          <Link href="/entrar">Portal do Assinante</Link>
        </nav>
        <p className="pl-footer-legal">
          Ponto do Pedido · © {new Date().getFullYear()} · Desenvolvido por{' '}
          <a href={`https://${DEVELOPER}`} target="_blank" rel="noreferrer">
            {DEVELOPER}
          </a>
        </p>
      </footer>
    </div>
  );
}
