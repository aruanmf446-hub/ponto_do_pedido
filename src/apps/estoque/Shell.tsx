import type { ReactNode } from 'react';
import type { InternalApp } from '@/core/apps';
import type { UiPreference } from '@/core/prefs';
import { extraAreas, type TenantContext } from '@/core/tenant/context';
import { AppSwitcher } from '@/core/ui/AppSwitcher';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import { Icon } from '@/core/ui/Icon';
import { ModelPicker } from '@/core/ui/ModelPicker';
import { TenantProvider } from '@/core/ui/TenantProvider';
import { EstoqueNav } from '@/apps/estoque/Nav';
import { estoqueFonts } from '@/apps/estoque/fonts';
import { ESTOQUE_MODELS } from '@/apps/estoque/models';
import '@/apps/estoque/estoque.css';

/**
 * Moldura do Estoque. m1 controle industrial com menu lateral claro;
 * m2 lotes e validade com navegação no topo; m3 conferência com menu
 * lateral escuro e trilha; m4 solicitações com abas sublinhadas.
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
  const alertCount = alerts.below + alerts.expiring + alerts.expired;
  const tools = (
    <div className="es-tools">
      <span className="es-bell" title={`${alertCount} alertas`} aria-label={`${alertCount} alertas do estoque`}>
        <Icon name="bell" size={18} />
        {alertCount > 0 ? <span>{alertCount}</span> : null}
      </span>
      <ModelPicker tenantId={ctx.tenant.id} app="estoque" current={model} scheme={pref.scheme} options={ESTOQUE_MODELS} />
      <AppSwitcher
        base={base}
        apps={apps}
        current="estoque"
        userName={ctx.membership.display_name}
        role={ctx.membership.is_owner ? 'Titular' : ctx.membership.job_title}
        extras={extraAreas(ctx)}
        className="es-switcher"
      />
    </div>
  );
  const nav = <EstoqueNav base={base} badges={badges} />;
  const signals = (
    <ul className="es-signals" aria-label="Alertas do estoque">
      <li data-on={alerts.below > 0} data-tone="warn">
        <Icon name="trend-down" size={14} /> <b>{alerts.below}</b> abaixo do mínimo
      </li>
      <li data-on={alerts.expiring > 0} data-tone="warn">
        <Icon name="clock" size={14} /> <b>{alerts.expiring}</b> vencendo em 7 dias
      </li>
      <li data-on={alerts.expired > 0} data-tone="danger">
        <Icon name="alert" size={14} /> <b>{alerts.expired}</b> vencidos
      </li>
    </ul>
  );
  const notice = external ? (
    <p className="es-external" role="note">
      O estoque deste estabelecimento está definido como responsabilidade do ERP/sistema externo. Aqui ficam apenas consultas e solicitações; a alteração é feita na Gestão → Operação.
    </p>
  ) : null;
  const footer = <PlatformFooter appName="Estoque" className="es-footer" />;
  const sided = model === 'm1' || model === 'm3';

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
        {sided ? (
          <div className="es-frame">
            <aside className="es-side">
              {brand}
              <p className="es-app">
                <Icon name={model === 'm3' ? 'checklist' : 'boxes'} size={15} /> {model === 'm3' ? 'Conferência' : 'Estoque'}
              </p>
              {nav}
            </aside>
            <div className="es-body">
              <header className="es-head">
                {model === 'm3' ? (
                  <span className="es-crumbs">
                    Estoque <Icon name="chevron" size={14} /> Conferência e inventário
                  </span>
                ) : (
                  signals
                )}
                {tools}
              </header>
              {notice}
              <main className="es-main">
                {model === 'm3' ? signals : null}
                {children}
              </main>
              {footer}
            </div>
          </div>
        ) : (
          <>
            <header className="es-head">
              {brand}
              {model === 'm2' ? <div className="es-topnav">{nav}</div> : <span className="es-app">Estoque</span>}
              {tools}
            </header>
            {model === 'm4' ? <div className="es-tabs">{nav}</div> : null}
            {notice}
            <main className="es-main">
              {signals}
              {children}
            </main>
            {footer}
          </>
        )}
      </div>
    </TenantProvider>
  );
}
