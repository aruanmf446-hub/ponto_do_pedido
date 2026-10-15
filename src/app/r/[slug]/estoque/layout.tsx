import type { ReactNode } from 'react';
import { EstoqueShell } from '@/apps/estoque/Shell';
import type { OverviewRow } from '@/apps/estoque/queries';
import { getUiPreference } from '@/core/prefs';
import { rpcRead } from '@/core/rpc';
import { createServerSupabase } from '@/core/supabase/server';
import { accessibleApps, requireApp, tenantBase } from '@/core/tenant/context';

export const dynamic = 'force-dynamic';

export default async function EstoqueLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'estoque');
  const t = ctx.tenant.id;
  const supabase = await createServerSupabase();
  const count = { count: 'exact' as const, head: true };
  const [pref, base, overview, requests, orders, counts] = await Promise.all([
    getUiPreference(t, 'estoque'),
    tenantBase(),
    rpcRead<OverviewRow[]>('stock_overview', { p_tenant: t }),
    supabase.from('material_requests').select('id', count).eq('tenant_id', t).in('status', ['requested', 'authorized']),
    supabase.from('purchase_orders').select('id', count).eq('tenant_id', t).in('status', ['issued', 'partially_received']),
    supabase.from('inventory_counts').select('id', count).eq('tenant_id', t).eq('status', 'open'),
  ]);
  return (
    <EstoqueShell
      ctx={ctx}
      pref={pref}
      base={base}
      apps={accessibleApps(ctx)}
      external={ctx.process_ownership.estoque === 'externo'}
      alerts={{
        below: overview.filter((r) => r.below_min).length,
        expiring: overview.filter((r) => Number(r.expiring_qty) > 0).length,
        expired: overview.filter((r) => Number(r.expired_qty) > 0).length,
      }}
      badges={{
        '/estoque/solicitacoes': requests.count ?? 0,
        '/estoque/entrada': orders.count ?? 0,
        '/estoque/inventario': counts.count ?? 0,
      }}
    >
      {children}
    </EstoqueShell>
  );
}
