import type { ReactNode } from 'react';
import { GestaoShell } from '@/apps/gestao/Shell';
import { pendingApprovalsCount } from '@/apps/gestao/queries';
import { getUiPreference } from '@/core/prefs';
import { accessibleApps, requireApp, tenantBase } from '@/core/tenant/context';

export const dynamic = 'force-dynamic';

export default async function GestaoLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'gestao');
  const [pref, base, pending] = await Promise.all([getUiPreference(ctx.tenant.id, 'gestao'), tenantBase(), pendingApprovalsCount(ctx.tenant.id)]);
  return (
    <GestaoShell ctx={ctx} pref={pref} base={base} apps={accessibleApps(ctx)} pendingApprovals={pending}>
      {children}
    </GestaoShell>
  );
}
