import type { ReactNode } from 'react';
import Link from 'next/link';
import type { InternalApp } from '@/core/apps';
import type { UiPreference } from '@/core/prefs';
import { extraAreas, type TenantContext } from '@/core/tenant/context';
import { AppSwitcher } from '@/core/ui/AppSwitcher';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import { Icon } from '@/core/ui/Icon';
import { ModelPicker } from '@/core/ui/ModelPicker';
import { TenantProvider } from '@/core/ui/TenantProvider';
import { atendimentoFonts } from '@/apps/atendimento/fonts';
import { ATENDIMENTO_MODELS } from '@/apps/atendimento/models';
import { AtendimentoNav } from '@/apps/atendimento/Nav';
import { ReadyAlerts } from '@/apps/atendimento/ReadyAlerts';
import '@/apps/atendimento/atendimento.css';

export function AtendimentoShell({
  ctx,
  pref,
  base,
  apps,
  children,
}: {
  ctx: TenantContext;
  pref: UiPreference;
  base: string;
  apps: InternalApp[];
  children: ReactNode;
}) {
  const model = pref.model;
  const brand = <TenantMark name={ctx.tenant.name} logoPath={ctx.tenant.logo_path} className="at-brand" />;
  const nav = <AtendimentoNav base={base} />;
  const tools = (
    <div className="at-tools">
      {apps.includes('gestao') ? <Link href={`${base}/gestao`} className="at-btn at-btn--small">Ir para Gestão</Link> : null}
      <ModelPicker tenantId={ctx.tenant.id} app="atendimento" current={model} scheme={pref.scheme} options={ATENDIMENTO_MODELS} />
      <AppSwitcher
        base={base}
        apps={apps}
        current="atendimento"
        userName={ctx.membership.display_name}
        role={ctx.membership.is_owner ? 'Titular' : ctx.membership.job_title}
        extras={extraAreas(ctx)}
        className="at-switcher"
      />
    </div>
  );
  const sideLayout = model === 'm2' || model === 'm4';
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
      <div className={`at ${atendimentoFonts}`} data-model={model} data-scheme={pref.scheme}>
        {sideLayout ? (
          <div className="at-frame">
            <aside className="at-side">
              {brand}
              {nav}
            </aside>
            <div className="at-body">
              <header className="at-head">
                <span className="at-head-title">
                  <Icon name={model === 'm2' ? 'grid' : 'service'} size={18} /> {model === 'm2' ? 'Mapa do salão' : 'Estação de atendimento'}
                </span>
                {tools}
              </header>
              <main className="at-main">{children}</main>
              <PlatformFooter appName="Atendimento" className="at-footer" />
            </div>
          </div>
        ) : (
          <>
            <header className="at-head">
              {brand}
              {nav}
              {tools}
            </header>
            <main className="at-main">{children}</main>
            <PlatformFooter appName="Atendimento" className="at-footer" />
          </>
        )}
        <ReadyAlerts tenantId={ctx.tenant.id} />
      </div>
    </TenantProvider>
  );
}
