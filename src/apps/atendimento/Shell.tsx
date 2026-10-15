import Link from 'next/link';
import type { ReactNode } from 'react';
import type { InternalApp } from '@/core/apps';
import type { UiPreference } from '@/core/prefs';
import { extraAreas, type TenantContext } from '@/core/tenant/context';
import { AppSwitcher } from '@/core/ui/AppSwitcher';
import { PlatformFooter, TenantMark } from '@/core/ui/Brand';
import { ModelPicker } from '@/core/ui/ModelPicker';
import { TenantProvider } from '@/core/ui/TenantProvider';
import { atendimentoFonts } from '@/apps/atendimento/fonts';
import { ATENDIMENTO_MODELS } from '@/apps/atendimento/models';
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
  const nav = (
    <nav className="at-nav" aria-label="Atendimento">
      <Link href={`${base}/atendimento`}>Mesas</Link>
      <Link href={`${base}/atendimento/comandas`}>Comandas</Link>
      <Link href={`${base}/atendimento/balcao`}>Balcão</Link>
      <Link href={`${base}/atendimento/aprovacoes`}>Aprovações</Link>
    </nav>
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
      <div className={`at ${atendimentoFonts}`} data-model={model} data-scheme={pref.scheme}>
        <header className="at-head">
          <TenantMark name={ctx.tenant.name} logoPath={ctx.tenant.logo_path} className="at-brand" />
          {model === 'm2' || model === 'm4' ? null : nav}
          <div className="at-tools">
            <ModelPicker tenantId={ctx.tenant.id} app="atendimento" current={model} scheme={pref.scheme} options={ATENDIMENTO_MODELS} label="Aparência" />
            <AppSwitcher base={base} apps={apps} current="atendimento" userName={ctx.membership.display_name} extras={extraAreas(ctx)} className="at-switcher" />
          </div>
        </header>
        <div className="at-frame">
          {model === 'm2' || model === 'm4' ? <aside className="at-side">{nav}</aside> : null}
          <main className="at-main">{children}</main>
        </div>
        <PlatformFooter appName="Atendimento" className="at-footer" />
        <ReadyAlerts tenantId={ctx.tenant.id} />
      </div>
    </TenantProvider>
  );
}
