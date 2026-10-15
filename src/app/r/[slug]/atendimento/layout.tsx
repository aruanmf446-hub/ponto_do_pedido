import type { ReactNode } from 'react';
import { AtendimentoShell } from '@/apps/atendimento/Shell';
import { getUiPreference } from '@/core/prefs';
import { accessibleApps, requireApp, tenantBase } from '@/core/tenant/context';

export const dynamic = 'force-dynamic';

export default async function AtendimentoLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'atendimento');
  const [pref, base] = await Promise.all([getUiPreference(ctx.tenant.id, 'atendimento'), tenantBase()]);
  return (
    <AtendimentoShell ctx={ctx} pref={pref} base={base} apps={accessibleApps(ctx)}>
      {children}
    </AtendimentoShell>
  );
}
