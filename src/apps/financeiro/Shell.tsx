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
import { FinanceiroNav } from '@/apps/financeiro/Nav';
import { financeiroFonts } from '@/apps/financeiro/fonts';
import { FINANCEIRO_MODELS } from '@/apps/financeiro/models';
import '@/apps/financeiro/financeiro.css';

/**
 * Moldura do Administrativo e Financeiro. Cada modelo muda a estrutura:
 * m1 painel executivo com menu lateral claro; m2 agenda com navegação no topo;
 * m3 escritório com pastas laterais; m4 console com barra lateral escura e fila.
 */
export function FinanceiroShell({
  ctx,
  pref,
  base,
  apps,
  visible,
  badges,
  children,
}: {
  ctx: TenantContext;
  pref: UiPreference;
  base: string;
  apps: InternalApp[];
  visible: string[];
  badges: Record<string, number>;
  children: ReactNode;
}) {
  const model = pref.model;
  const pending = Object.values(badges).reduce((a, b) => a + b, 0);
  const date = new Intl.DateTimeFormat('pt-BR', { timeZone: ctx.tenant.timezone, weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());
  const brand = <TenantMark name={ctx.tenant.name} logoPath={ctx.tenant.logo_path} className="fn-brand" />;
  const bell = (
    <Link href={`${base}/financeiro`} className="fn-bell" aria-label={`${pending} pendências`} title="Pendências">
      <Icon name="bell" size={18} />
      {pending > 0 ? <span>{pending}</span> : null}
    </Link>
  );
  const tools = (
    <div className="fn-tools">
      {bell}
      <ModelPicker tenantId={ctx.tenant.id} app="financeiro" current={model} scheme={pref.scheme} options={FINANCEIRO_MODELS} />
      <AppSwitcher
        base={base}
        apps={apps}
        current="financeiro"
        userName={ctx.membership.display_name}
        role={ctx.membership.is_owner ? 'Titular' : ctx.membership.job_title}
        extras={extraAreas(ctx)}
        className="fn-switcher"
      />
    </div>
  );
  const nav = <FinanceiroNav base={base} model={model} visible={visible} badges={badges} />;
  const footer = <PlatformFooter appName="Administrativo e Financeiro" className="fn-footer" />;

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
      <div className={`fn ${financeiroFonts}`} data-model={model} data-scheme={pref.scheme}>
        {model === 'm2' ? (
          <>
            <header className="fn-head">
              {brand}
              <span className="fn-app">
                <Icon name="calendar" size={16} /> Agenda financeira
              </span>
              <span className="fn-date">{date}</span>
              {tools}
            </header>
            <div className="fn-bar">{nav}</div>
            <main className="fn-main">{children}</main>
            {footer}
          </>
        ) : (
          <div className="fn-frame">
            <aside className="fn-side">
              {brand}
              {model === 'm3' ? (
                <p className="fn-app">
                  <Icon name="folder" size={15} /> Escritório contábil
                </p>
              ) : model === 'm4' ? (
                <p className="fn-app">
                  <Icon name="approvals" size={15} /> Console de aprovações
                </p>
              ) : (
                <p className="fn-app">
                  <Icon name="chart" size={15} /> Administrativo e Financeiro
                </p>
              )}
              {nav}
            </aside>
            <div className="fn-body">
              <header className="fn-head">
                {model === 'm4' ? (
                  <span className="fn-queue">
                    <Icon name="approvals" size={16} /> <b>{pending}</b> na fila de decisões
                  </span>
                ) : (
                  <p className="fn-date">{date}</p>
                )}
                {tools}
              </header>
              <main className="fn-main">{children}</main>
              {footer}
            </div>
          </div>
        )}
      </div>
    </TenantProvider>
  );
}
