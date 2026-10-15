import type { ReactNode } from 'react';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import '@/apps/acesso/acesso.css';

/** Moldura da entrada do estabelecimento (login e mensagens de acesso). */
export function AccessFrame({
  tenantName,
  logoPath,
  title,
  subtitle,
  children,
}: {
  tenantName: string;
  logoPath: string | null;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="ac-root">
      <main className="ac-card">
        <TenantMark name={tenantName} logoPath={logoPath} className="ac-mark" />
        <h1 className="ac-title">{title}</h1>
        {subtitle ? <p className="ac-subtitle">{subtitle}</p> : null}
        {children}
      </main>
      <PlatformFooter appName="Acesso da equipe" className="ac-footer" />
    </div>
  );
}
