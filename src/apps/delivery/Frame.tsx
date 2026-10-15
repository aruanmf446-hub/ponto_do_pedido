import type { ReactNode } from 'react';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import { SchemeToggle } from '@/core/ui/SchemeToggle';
import { deliveryFonts } from '@/apps/delivery/fonts';
import '@/apps/delivery/delivery.css';

/** Moldura do Delivery: identidade própria e vibrante, apenas claro/escuro. */
export function DeliveryFrame({ name, logoPath, children, tools }: { name: string; logoPath: string | null; children: ReactNode; tools?: ReactNode }) {
  return (
    <div className={`dl ${deliveryFonts}`}>
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
