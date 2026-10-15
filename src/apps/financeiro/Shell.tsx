import type { ReactNode } from 'react';
import type { InternalApp } from '@/core/apps';
import type { UiPreference } from '@/core/prefs';
import type { TenantContext } from '@/core/tenant/context';
import { AppSwitcher } from '@/core/ui/AppSwitcher';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import { ModelPicker } from '@/core/ui/ModelPicker';
import { TenantProvider } from '@/core/ui/TenantProvider';
import { FinanceiroNav } from '@/apps/financeiro/Nav';
import { financeiroFonts } from '@/apps/financeiro/fonts';
import { FINANCEIRO_MODELS } from '@/apps/financeiro/models';
import '@/apps/financeiro/financeiro.css';

/**
 * Moldura do Administrativo e Financeiro. Cada modelo muda a estrutura:
 * m1 escritório com pastas laterais; m2 console com barra de comando e fila;
 * m3 livro-razão com abas horizontais; m4 agenda com trilho de ícones.
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
  const tools = (
    <div className="fn-tools">
      <ModelPicker tenantId={ctx.tenant.id} app="financeiro" current={model} scheme={pref.scheme} options={FINANCEIRO_MODELS} label="Aparência" />
      <AppSwitcher base={base} apps={apps} current="financeiro" userName={ctx.membership.display_name} className="fn-switcher" />
    </div>
  );
  const nav = <FinanceiroNav base={base} model={model} visible={visible} badges={badges} />;

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
        {model === 'm1' ? (
          <div className="fn-frame">
            <aside className="fn-side">
              {brand}
              <p className="fn-app">Administrativo e Financeiro</p>
              {nav}
            </aside>
            <div className="fn-body">
              <header className="fn-head">
                <p className="fn-date">{date}</p>
                {tools}
              </header>
              <main className="fn-main">{children}</main>
              <PlatformFooter appName="Administrativo e Financeiro" className="fn-footer" />
            </div>
          </div>
        ) : model === 'm2' ? (
          <>
            <header className="fn-head">
              {brand}
              <span className="fn-app">ADM/FIN · console</span>
              <span className="fn-queue" aria-label={`${pending} pendências`}>
                <b>{pending}</b> pendências
              </span>
              {tools}
            </header>
            <div className="fn-bar">{nav}</div>
            <main className="fn-main">{children}</main>
            <PlatformFooter appName="Administrativo e Financeiro" className="fn-footer" />
          </>
        ) : model === 'm3' ? (
          <>
            <header className="fn-head">
              {brand}
              <div className="fn-ledger-title">
                <span className="fn-app">Livro-Razão</span>
                <span className="fn-date">{date}</span>
              </div>
              {tools}
            </header>
            <div className="fn-tabs">{nav}</div>
            <main className="fn-main">{children}</main>
            <PlatformFooter appName="Administrativo e Financeiro" className="fn-footer" />
          </>
        ) : (
          <div className="fn-frame">
            <aside className="fn-rail">{nav}</aside>
            <div className="fn-body">
              <header className="fn-head">
                {brand}
                <span className="fn-app">Agenda financeira</span>
                {tools}
              </header>
              <main className="fn-main">{children}</main>
              <PlatformFooter appName="Administrativo e Financeiro" className="fn-footer" />
            </div>
          </div>
        )}
      </div>
    </TenantProvider>
  );
}
