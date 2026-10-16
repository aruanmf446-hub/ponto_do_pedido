import Link from 'next/link';
import type { ReactNode } from 'react';
import { DEVELOPER } from '@/core/config';
import { SchemeToggle } from '@/core/ui/SchemeToggle';
import { condensed, display, editorial, sora, text } from '@/apps/plataforma/fonts';
import '@/apps/plataforma/plataforma.css';

export function PlatformMark() {
  return (
    <Link href="/" className="pl-mark" aria-label="Ponto do Pedido — início">
      <svg className="pl-mark-logo" viewBox="210 195 880 870" aria-hidden="true" focusable="false">
        <path
          fill="#cc5435"
          d="M350 205H740C940 205 1082 360 1082 562C1082 770 940 912 740 912H690L604 1034Q582 1062 546 1050Q507 1035 507 1000V850Q507 772 590 772H735C840 772 925 690 925 565C925 440 840 352 735 352H405V665Q405 740 327 740Q250 740 250 665V300Q250 205 350 205Z"
        />
        <rect fill="#cc5435" x="485" y="433" width="320" height="98" rx="49" />
        <rect fill="#cc5435" x="485" y="601" width="320" height="98" rx="49" />
        <circle fill="#717f62" cx="333" cy="902" r="120" />
      </svg>
      <span className="pl-mark-text">
        pontodopedido<span>.com</span>
      </span>
    </Link>
  );
}

/** Estrutura do site institucional e do portal (claro/escuro). */
export function PlatformChrome({ children, signedIn, portal }: { children: ReactNode; signedIn: boolean; portal?: boolean }) {
  return (
    <div className={`pl ${display.variable} ${condensed.variable} ${text.variable} ${editorial.variable} ${sora.variable}`}>
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
                Nossos planos
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
