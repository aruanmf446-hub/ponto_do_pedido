import type { ReactNode } from 'react';
import type { InternalApp } from '@/core/apps';
import type { UiPreference } from '@/core/prefs';
import { extraAreas, type TenantContext } from '@/core/tenant/context';
import { AppSwitcher } from '@/core/ui/AppSwitcher';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import { Icon } from '@/core/ui/Icon';
import { ModelPicker } from '@/core/ui/ModelPicker';
import { TenantProvider } from '@/core/ui/TenantProvider';
import { CozinhaNav, KitchenClock } from '@/apps/cozinha/Nav';
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
  const brand = <TenantMark name={ctx.tenant.name} logoPath={ctx.tenant.logo_path} className="kz-brand" />;
  const nav = <CozinhaNav base={base} canRequestMaterials={canRequestMaterials} />;
  const tools = (
    <div className="kz-tools">
      <ModelPicker tenantId={ctx.tenant.id} app="cozinha" current={model} scheme={pref.scheme} options={COZINHA_MODELS} />
      <AppSwitcher
        base={base}
        apps={apps}
        current="cozinha"
        userName={ctx.membership.display_name}
        role={ctx.membership.is_owner ? 'Titular' : ctx.membership.job_title}
        extras={extraAreas(ctx)}
        className="kz-switcher"
      />
    </div>
  );
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
        {model === 'm4' ? (
          <div className="kz-frame">
            <aside className="kz-side">
              {brand}
              {nav}
            </aside>
            <div className="kz-body">
              <header className="kz-head">
                <span className="kz-app">
                  <Icon name="timer" size={16} /> Comando de produção
                </span>
                <KitchenClock timezone={ctx.tenant.timezone} />
                {tools}
              </header>
              <main className="kz-main">{children}</main>
              <PlatformFooter appName="Cozinha" className="kz-footer" />
            </div>
          </div>
        ) : (
          <>
            <header className="kz-head">
              {brand}
              <span className="kz-app">
                <Icon name="chef" size={16} /> Cozinha
              </span>
              {nav}
              <KitchenClock timezone={ctx.tenant.timezone} />
              {tools}
            </header>
            <main className="kz-main">{children}</main>
            <PlatformFooter appName="Cozinha" className="kz-footer" />
          </>
        )}
      </div>
    </TenantProvider>
  );
}
