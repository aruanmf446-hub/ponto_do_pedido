import Link from 'next/link';
import type { ReactNode } from 'react';
import type { InternalApp } from '@/core/apps';
import type { UiPreference } from '@/core/prefs';
import { extraAreas, type TenantContext } from '@/core/tenant/context';
import { AppSwitcher } from '@/core/ui/AppSwitcher';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import { Icon } from '@/core/ui/Icon';
import { ModelPicker } from '@/core/ui/ModelPicker';
import { TenantProvider } from '@/core/ui/TenantProvider';
import { gestaoFonts } from '@/apps/gestao/fonts';
import { GESTAO_MODELS, GESTAO_NAV } from '@/apps/gestao/models';
import { GestaoCrumbs, GestaoNav } from '@/apps/gestao/Nav';
import '@/apps/gestao/gestao.css';

/**
 * Estrutura da Gestão. Cada modelo muda a composição: navegação, cabeçalho,
 * densidade, tipografia e componentes — não apenas cores.
 * m1 Centro de Comando · m2 Workspace Editorial · m3 Suíte Empresarial · m4 Sala de Controle
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
  const picker = <ModelPicker tenantId={ctx.tenant.id} app="gestao" current={model} scheme={pref.scheme} options={GESTAO_MODELS} />;
  const switcher = (
    <AppSwitcher
      base={base}
      apps={apps}
      current="gestao"
      userName={ctx.membership.display_name}
      role={ctx.membership.is_owner ? 'Titular' : ctx.membership.job_title}
      extras={extraAreas(ctx)}
      className="gs-switcher"
    />
  );
  const bell = (
    <Link href={`${base}/gestao/aprovacoes`} className="gs-iconbtn" aria-label={`Aprovações pendentes: ${pendingApprovals}`} title="Aprovações pendentes">
      <Icon name="bell" size={18} />
      {pendingApprovals > 0 ? <span className="gs-dot">{pendingApprovals}</span> : null}
    </Link>
  );
  const tools = (
    <div className="gs-top-tools">
      {bell}
      {picker}
      {switcher}
    </div>
  );
  const footer = <PlatformFooter appName="Gestão" className="gs-footer" />;
  const nav = (grouped: boolean) => <GestaoNav items={items} base={base} grouped={grouped} pendingApprovals={pendingApprovals} />;

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

  let layout: ReactNode;
  if (model === 'm2') {
    layout = (
      <>
        <header className="gs-top">
          {brand}
          {tools}
        </header>
        <div className="gs-topnav">{nav(false)}</div>
        <main className="gs-main">{children}</main>
        {footer}
      </>
    );
  } else if (model === 'm3') {
    layout = (
      <div className="gs-body">
        <aside className="gs-side">
          {brand}
          <p className="gs-suite">Gestão empresarial</p>
          {nav(true)}
        </aside>
        <div className="gs-content">
          <header className="gs-top">
            <GestaoCrumbs items={items} base={base} />
            {tools}
          </header>
          <main className="gs-main">{children}</main>
          {footer}
        </div>
      </div>
    );
  } else if (model === 'm4') {
    layout = (
      <div className="gs-body">
        <aside className="gs-side">
          {brand}
          {nav(false)}
          <div className="gs-side-status">
            <span className="gs-live" /> Operação ao vivo
          </div>
        </aside>
        <div className="gs-content">
          <header className="gs-top">
            <span className="gs-top-title">
              <Icon name="monitor" size={18} /> Sala de Controle
            </span>
            {tools}
          </header>
          <main className="gs-main">{children}</main>
          {footer}
        </div>
      </div>
    );
  } else {
    layout = (
      <div className="gs-body">
        <aside className="gs-side">
          {brand}
          {nav(true)}
        </aside>
        <div className="gs-content">
          <header className="gs-top">
            <span className="gs-top-title">
              <Icon name="dashboard" size={18} /> Centro de Comando
            </span>
            {tools}
          </header>
          <main className="gs-main">{children}</main>
          {footer}
        </div>
      </div>
    );
  }

  return (
    <TenantProvider value={provider}>
      <div className={`gs ${gestaoFonts}`} data-model={model} data-scheme={pref.scheme}>
        {layout}
      </div>
    </TenantProvider>
  );
}
