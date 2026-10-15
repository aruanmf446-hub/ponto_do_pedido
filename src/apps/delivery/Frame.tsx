import type { ReactNode } from 'react';
import type { VisualModel } from '@/core/apps';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import { SchemeToggle } from '@/core/ui/SchemeToggle';
import { deliveryFonts } from '@/apps/delivery/fonts';
import '@/apps/delivery/delivery.css';

/**
 * Moldura do Delivery. O modelo (m1..m4) é escolhido pelo restaurante na
 * Gestão; o cliente escolhe apenas claro/escuro.
 */
export function DeliveryFrame({
  name,
  logoPath,
  children,
  tools,
  template = 'm2',
}: {
  name: string;
  logoPath: string | null;
  children: ReactNode;
  tools?: ReactNode;
  template?: VisualModel;
}) {
  return (
    <div className={`dl ${deliveryFonts}`} data-template={template}>
      <header className="dl-head">
        <TenantMark name={name} logoPath={logoPath} className="dl-brand" />
        <span className="dl-tag">Delivery</span>
        <div className="dl-tools">
          {tools}
          <SchemeToggle className="dl-scheme" />
        </div>
      </header>
      <main className="dl-main">{children}</main>
      <PlatformFooter appName="Delivery" className="dl-footer" />
    </div>
  );
}
