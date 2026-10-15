import type { ReactNode } from 'react';
import type { InternalApp } from '@/core/apps';
import { formatDateTime } from '@/core/dates';
import { formatCents } from '@/core/money';
import type { UiPreference } from '@/core/prefs';
import { extraAreas, type TenantContext } from '@/core/tenant/context';
import { AppSwitcher } from '@/core/ui/AppSwitcher';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import { Icon } from '@/core/ui/Icon';
import { ModelPicker } from '@/core/ui/ModelPicker';
import { TenantProvider } from '@/core/ui/TenantProvider';
import { caixaFonts } from '@/apps/caixa/fonts';
import { CAIXA_MODELS } from '@/apps/caixa/models';
import { CaixaNav } from '@/apps/caixa/Nav';
import type { CashSession } from '@/apps/caixa/queries';
import '@/apps/caixa/caixa.css';

export function CaixaShell({
  ctx,
  pref,
  base,
  apps,
  session,
  children,
}: {
  ctx: TenantContext;
  pref: UiPreference;
  base: string;
  apps: InternalApp[];
  session: CashSession | null;
  children: ReactNode;
}) {
  const model = pref.model;
  const brand = <TenantMark name={ctx.tenant.name} logoPath={ctx.tenant.logo_path} className="cx-brand" />;
  const tools = (
    <div className="cx-tools">
      <ModelPicker tenantId={ctx.tenant.id} app="caixa" current={model} scheme={pref.scheme} options={CAIXA_MODELS} />
      <AppSwitcher
        base={base}
        apps={apps}
        current="caixa"
        userName={ctx.membership.display_name}
        role={ctx.membership.is_owner ? 'Titular' : ctx.membership.job_title}
        extras={extraAreas(ctx)}
        className="cx-switcher"
      />
    </div>
  );
  const status = (
    <span className="cx-session" data-open={!!session}>
      <Icon name={session ? 'check' : 'lock'} size={14} />
      {session ? `Caixa aberto · ${formatDateTime(session.opened_at, ctx.tenant.timezone)} · fundo ${formatCents(session.opening_cents)}` : 'Caixa fechado'}
    </span>
  );
  const nav = <CaixaNav base={base} model={model} />;
  const footer = <PlatformFooter appName="Caixa" className="cx-footer" />;

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
      <div className={`cx ${caixaFonts}`} data-model={model} data-scheme={pref.scheme}>
        {model === 'm2' ? (
          <div className="cx-terminal">
            <header className="cx-head">
              {brand}
              <span className="cx-prompt">caixa@{ctx.tenant.slug}:~$</span>
              {status}
              {tools}
            </header>
            <div className="cx-term-body">
              <aside className="cx-side">{nav}</aside>
              <main className="cx-main">{children}</main>
            </div>
            {footer}
          </div>
        ) : model === 'm4' ? (
          <div className="cx-erp">
            <header className="cx-head">
              {brand}
              {tools}
            </header>
            <div className="cx-menubar">{nav}</div>
            <main className="cx-main">
              <div className="cx-window">
                <div className="cx-window-title">Caixa — {ctx.tenant.name}</div>
                <div className="cx-window-body">{children}</div>
              </div>
            </main>
            <div className="cx-statusbar">
              <span>Operador: {ctx.membership.display_name}</span>
              {status}
              <span>Plano {ctx.tenant.plan_code?.toUpperCase()}</span>
            </div>
            {footer}
          </div>
        ) : model === 'm3' ? (
          <div className="cx-touch">
            <header className="cx-head">
              {brand}
              {status}
              {tools}
            </header>
            <main className="cx-main">{children}</main>
            {footer}
            <div className="cx-tabbar">{nav}</div>
          </div>
        ) : (
          <div className="cx-minimal">
            <header className="cx-head">
              {brand}
              <div className="cx-headnav">{nav}</div>
              {tools}
            </header>
            <div className="cx-statusline">{status}</div>
            <main className="cx-main">{children}</main>
            {footer}
          </div>
        )}
      </div>
    </TenantProvider>
  );
}
