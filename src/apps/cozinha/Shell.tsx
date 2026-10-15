import Link from 'next/link';
import type { ReactNode } from 'react';
import type { InternalApp } from '@/core/apps';
import type { UiPreference } from '@/core/prefs';
import { extraAreas, type TenantContext } from '@/core/tenant/context';
import { AppSwitcher } from '@/core/ui/AppSwitcher';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import { ModelPicker } from '@/core/ui/ModelPicker';
import { TenantProvider } from '@/core/ui/TenantProvider';
import { cozinhaFonts } from '@/apps/cozinha/fonts';
import { COZINHA_MODELS } from '@/apps/cozinha/models';
import '@/apps/cozinha/cozinha.css';

export function CozinhaShell({
  ctx,
  pref,
  base,
  apps,
  canRequestMaterials,
  children,
}: {
  ctx: TenantContext;
  pref: UiPreference;
  base: string;
  apps: InternalApp[];
  canRequestMaterials: boolean;
  children: ReactNode;
}) {
  const model = pref.model;
  const clock = new Intl.DateTimeFormat('pt-BR', { timeZone: ctx.tenant.timezone, weekday: 'short', day: '2-digit', month: 'short' }).format(new Date());
  return (
    <TenantProvider
      value={{
        tenantId: ctx.tenant.id,
        slug: ctx.tenant.slug,
        base,
        timezone: ctx.tenant.timezone,
        model,
        permissions: ctx.permissions,
        userId: ctx.membership.user_id,
        isOwner: ctx.membership.is_owner,
      }}
    >
      <div className={`kz ${cozinhaFonts}`} data-model={model} data-scheme={pref.scheme}>
        <header className="kz-head">
          <TenantMark name={ctx.tenant.name} logoPath={ctx.tenant.logo_path} className="kz-brand" />
          <span className="kz-app">Cozinha</span>
          <nav className="kz-nav" aria-label="Cozinha">
            <Link href={`${base}/cozinha`}>Pedidos</Link>
            {canRequestMaterials ? <Link href={`${base}/cozinha/materiais`}>Solicitar material</Link> : null}
          </nav>
          <span className="kz-date">{clock}</span>
          <div className="kz-tools">
            <ModelPicker tenantId={ctx.tenant.id} app="cozinha" current={model} scheme={pref.scheme} options={COZINHA_MODELS} label="Aparência" />
            <AppSwitcher base={base} apps={apps} current="cozinha" userName={ctx.membership.display_name} extras={extraAreas(ctx)} className="kz-switcher" />
          </div>
        </header>
        <main className="kz-main">{children}</main>
        <PlatformFooter appName="Cozinha" className="kz-footer" />
      </div>
    </TenantProvider>
  );
}
