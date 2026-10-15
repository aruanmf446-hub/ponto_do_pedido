import type { ReactNode } from 'react';
import type { VisualModel } from '@/core/apps';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import { SchemeToggle } from '@/core/ui/SchemeToggle';
import { cardapioFonts } from '@/apps/cardapio/fonts';
import '@/apps/cardapio/cardapio.css';

/**
 * Moldura do Cardápio Local. O modelo (m1..m4) é escolhido pelo restaurante
 * na Gestão; o cliente escolhe apenas claro/escuro.
 */
export function CardapioFrame({
  name,
  logoPath,
  subtitle,
  template = 'm1',
  children,
}: {
  name: string;
  logoPath: string | null;
  subtitle?: string;
  template?: VisualModel;
  children: ReactNode;
}) {
  return (
    <div className={`cd ${cardapioFonts}`} data-template={template}>
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
