import type { ReactNode } from 'react';
import { loadOpenSession } from '@/apps/caixa/queries';
import { CaixaShell } from '@/apps/caixa/Shell';
import { getUiPreference } from '@/core/prefs';
import { accessibleApps, requireApp, tenantBase } from '@/core/tenant/context';

export const dynamic = 'force-dynamic';

export default async function CaixaLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'caixa');
  const [pref, base, session] = await Promise.all([
    getUiPreference(ctx.tenant.id, 'caixa'),
    tenantBase(),
    loadOpenSession(ctx.tenant.id, ctx.membership.user_id),
  ]);
  return (
    <CaixaShell ctx={ctx} pref={pref} base={base} apps={accessibleApps(ctx)} session={session}>
      {children}
    </CaixaShell>
  );
}
