import type { ReactNode } from 'react';
import type { InternalApp } from '@/core/apps';
import type { UiPreference } from '@/core/prefs';
import { extraAreas, type TenantContext } from '@/core/tenant/context';
import { AppSwitcher } from '@/core/ui/AppSwitcher';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import { ModelPicker } from '@/core/ui/ModelPicker';
import { TenantProvider } from '@/core/ui/TenantProvider';
import { gestaoFonts } from '@/apps/gestao/fonts';
import { GESTAO_MODELS, GESTAO_NAV } from '@/apps/gestao/models';
import { GestaoNav } from '@/apps/gestao/Nav';
import '@/apps/gestao/gestao.css';

/**
 * Estrutura da Gestão. Cada modelo muda a composição: posição e tipo de
 * navegação, cabeçalho, densidade e tipografia — não apenas cores.
 */
export function GestaoShell({
  ctx,
  pref,
  base,
  apps,
  pendingApprovals,
  children,
}: {
  ctx: TenantContext;
  pref: UiPreference;
  base: string;
  apps: InternalApp[];
  pendingApprovals: number;
  children: ReactNode;
}) {
  const items = GESTAO_NAV.filter((i) => !i.permission || ctx.membership.is_owner || ctx.permissions[i.permission]);
  const model = pref.model;
  const brand = <TenantMark name={ctx.tenant.name} logoPath={ctx.tenant.logo_path} className="gs-brand" />;
  const picker = (
    <ModelPicker tenantId={ctx.tenant.id} app="gestao" current={model} scheme={pref.scheme} options={GESTAO_MODELS} label="Aparência" />
  );
  const switcher = <AppSwitcher base={base} apps={apps} current="gestao" userName={ctx.membership.display_name} extras={extraAreas(ctx)} className="gs-switcher" />;
  const footer = <PlatformFooter appName="Gestão" className="gs-footer" />;
  const nav = <GestaoNav items={items} base={base} grouped={model === 'm3' || model === 'm1'} pendingApprovals={pendingApprovals} />;

  const provider = {
    tenantId: ctx.tenant.id,
    slug: ctx.tenant.slug,
    base,
    timezone: ctx.tenant.timezone,
    model,
    permissions: ctx.permissions,
    userId: ctx.membership.user_id,
    isOwner: ctx.membership.is_owner,
  };

  return (
    <TenantProvider value={provider}>
      <div className={`gs ${gestaoFonts}`} data-model={model} data-scheme={pref.scheme}>
        {model === 'm2' ? (
          <>
            <header className="gs-top">
              {brand}
              <div className="gs-top-tools">
                {picker}
                {switcher}
              </div>
            </header>
            <div className="gs-topnav">{nav}</div>
            <main className="gs-main">{children}</main>
            {footer}
          </>
        ) : model === 'm3' ? (
          <>
            <header className="gs-top">
              {brand}
              <span className="gs-suite">Gestão Empresarial</span>
              <div className="gs-top-tools">
                {picker}
                {switcher}
              </div>
            </header>
            <div className="gs-body">
              <aside className="gs-side">{nav}</aside>
              <div className="gs-content">
                <main className="gs-main">{children}</main>
                {footer}
              </div>
            </div>
          </>
        ) : model === 'm4' ? (
          <div className="gs-body">
            <aside className="gs-rail">
              {brand}
              {nav}
            </aside>
            <div className="gs-content">
              <header className="gs-top">
                <span className="gs-top-title">Sala de Controle</span>
                <div className="gs-top-tools">
                  {picker}
                  {switcher}
                </div>
              </header>
              <main className="gs-main">{children}</main>
              {footer}
            </div>
          </div>
        ) : (
          <div className="gs-body">
            <aside className="gs-side">
              {brand}
              {nav}
              {footer}
            </aside>
            <div className="gs-content">
              <header className="gs-top">
                <span className="gs-top-title">Gestão</span>
                <div className="gs-top-tools">
                  {picker}
                  {switcher}
                </div>
              </header>
              <main className="gs-main">{children}</main>
            </div>
          </div>
        )}
      </div>
    </TenantProvider>
  );
}
