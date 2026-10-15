import type { ReactNode } from 'react';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import { SchemeToggle } from '@/core/ui/SchemeToggle';
import { cardapioFonts } from '@/apps/cardapio/fonts';
import '@/apps/cardapio/cardapio.css';

/** Moldura do Cardápio Local: experiência gastronômica, apenas claro/escuro. */
export function CardapioFrame({ name, logoPath, subtitle, children }: { name: string; logoPath: string | null; subtitle?: string; children: ReactNode }) {
  return (
    <div className={`cd ${cardapioFonts}`}>
      <header className="cd-head">
        <TenantMark name={name} logoPath={logoPath} className="cd-brand" />
        {subtitle ? <span className="cd-sub">{subtitle}</span> : null}
        <SchemeToggle className="cd-scheme" />
      </header>
      <main className="cd-main">{children}</main>
      <PlatformFooter appName="Cardápio Digital" className="cd-footer" />
    </div>
  );
}
