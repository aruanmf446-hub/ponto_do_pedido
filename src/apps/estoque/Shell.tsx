import type { ReactNode } from 'react';
import type { InternalApp } from '@/core/apps';
import type { UiPreference } from '@/core/prefs';
import { extraAreas, type TenantContext } from '@/core/tenant/context';
import { AppSwitcher } from '@/core/ui/AppSwitcher';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import { ModelPicker } from '@/core/ui/ModelPicker';
import { TenantProvider } from '@/core/ui/TenantProvider';
import { EstoqueNav } from '@/apps/estoque/Nav';
import { estoqueFonts } from '@/apps/estoque/fonts';
import { ESTOQUE_MODELS } from '@/apps/estoque/models';
import '@/apps/estoque/estoque.css';

/**
 * Moldura do Estoque. m1 painel industrial com faixa de alerta e menu
 * numerado; m2 faixa de validade no topo e navegação em fita; m3 prancheta
 * centralizada com abas; m4 coluna de ícones e feed.
 */
export function EstoqueShell({
  ctx,
  pref,
  base,
  apps,
  badges,
  alerts,
  external,
  children,
}: {
  ctx: TenantContext;
  pref: UiPreference;
  base: string;
  apps: InternalApp[];
  badges: Record<string, number>;
  alerts: { below: number; expiring: number; expired: number };
  external: boolean;
  children: ReactNode;
}) {
  const model = pref.model;
  const brand = <TenantMark name={ctx.tenant.name} logoPath={ctx.tenant.logo_path} className="es-brand" />;
  const tools = (
    <div className="es-tools">
      <ModelPicker tenantId={ctx.tenant.id} app="estoque" current={model} scheme={pref.scheme} options={ESTOQUE_MODELS} label="Aparência" />
      <AppSwitcher base={base} apps={apps} current="estoque" userName={ctx.membership.display_name} extras={extraAreas(ctx)} className="es-switcher" />
    </div>
  );
  const nav = <EstoqueNav base={base} model={model} badges={badges} />;
  const signals = (
    <ul className="es-signals" aria-label="Alertas do estoque">
      <li data-on={alerts.below > 0}>
        <b>{alerts.below}</b> abaixo do mínimo
      </li>
      <li data-on={alerts.expiring > 0} data-tone="warn">
        <b>{alerts.expiring}</b> vencendo em 7 dias
      </li>
      <li data-on={alerts.expired > 0} data-tone="danger">
        <b>{alerts.expired}</b> vencidos
      </li>
    </ul>
  );
  const notice = external ? (
    <p className="es-external" role="note">
      O estoque deste estabelecimento está definido como responsabilidade do ERP/sistema externo. Aqui ficam apenas consultas e solicitações; a alteração é feita na Gestão → Operação.
    </p>
  ) : null;

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
      <div className={`es ${estoqueFonts}`} data-model={model} data-scheme={pref.scheme} data-external={external}>
        {model === 'm4' ? (
          <div className="es-frame">
            <aside className="es-rail">{nav}</aside>
            <div className="es-body">
              <header className="es-head">
                {brand}
                <span className="es-app">Estoque</span>
                {signals}
                {tools}
              </header>
              {notice}
              <main className="es-main">{children}</main>
              <PlatformFooter appName="Estoque" className="es-footer" />
            </div>
          </div>
        ) : (
          <>
            <header className="es-head">
              {brand}
              <span className="es-app">{model === 'm1' ? 'ESTOQUE · CONTROLE' : model === 'm2' ? 'Estoque · lotes e validade' : 'Estoque · conferência'}</span>
              {model === 'm3' ? null : signals}
              {tools}
            </header>
            <div className="es-navbar">{nav}</div>
            {notice}
            <main className="es-main">
              {model === 'm3' ? signals : null}
              {children}
            </main>
            <PlatformFooter appName="Estoque" className="es-footer" />
          </>
        )}
      </div>
    </TenantProvider>
  );
}
