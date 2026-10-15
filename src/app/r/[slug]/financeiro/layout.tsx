import type { ReactNode } from 'react';
import { FinanceiroShell } from '@/apps/financeiro/Shell';
import { FINANCEIRO_NAV } from '@/apps/financeiro/models';
import { todayIn } from '@/apps/financeiro/queries';
import { getUiPreference } from '@/core/prefs';
import { createServerSupabase } from '@/core/supabase/server';
import { accessibleApps, requireApp, tenantBase } from '@/core/tenant/context';

export const dynamic = 'force-dynamic';

export default async function FinanceiroLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'financeiro');
  const supabase = await createServerSupabase();
  const t = ctx.tenant.id;
  const today = todayIn(ctx.tenant.timezone);
  const count = { count: 'exact' as const, head: true };
  const [pref, base, purchases, payables, reimbursements, supplies] = await Promise.all([
    getUiPreference(t, 'financeiro'),
    tenantBase(),
    supabase.from('purchase_requests').select('id', count).eq('tenant_id', t).in('status', ['requested', 'quoting', 'approved']),
    supabase.from('payables').select('id', count).eq('tenant_id', t).eq('status', 'open').lte('due_date', today),
    supabase.from('reimbursements').select('id', count).eq('tenant_id', t).eq('status', 'requested'),
    supabase.from('material_requests').select('id', count).eq('tenant_id', t).eq('status', 'requested'),
  ]);
  // Suprimentos só aparece quando o estoque é controlado aqui
  const visible = FINANCEIRO_NAV.filter((i) => i.href !== '/financeiro/suprimentos' || ctx.process_ownership.estoque !== 'externo').map((i) => i.href);
  return (
    <FinanceiroShell
      ctx={ctx}
      pref={pref}
      base={base}
      apps={accessibleApps(ctx)}
      visible={visible}
      badges={{
        '/financeiro/compras': purchases.count ?? 0,
        '/financeiro/pagar': payables.count ?? 0,
        '/financeiro/reembolsos': reimbursements.count ?? 0,
        '/financeiro/suprimentos': ctx.process_ownership.estoque === 'externo' ? 0 : (supplies.count ?? 0),
      }}
    >
      {children}
    </FinanceiroShell>
  );
}
