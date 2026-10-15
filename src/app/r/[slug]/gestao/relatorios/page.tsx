import { periodFromSearch } from '@/apps/gestao/pages/Dashboard';
import { Reports } from '@/apps/gestao/pages/Reports';
import { loadKpis } from '@/apps/gestao/queries';
import { Forbidden } from '@/apps/gestao/Forbidden';
import { businessDay } from '@/core/dates';
import { can, requireApp, tenantBase } from '@/core/tenant/context';

export default async function ReportsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireApp(slug, 'gestao');
  if (!can(ctx, 'gestao.indicadores.visualizar')) return <Forbidden />;
  const today = businessDay(new Date(), ctx.tenant.timezone, ctx.tenant.business_day_start_hour);
  const period = periodFromSearch(today, sp.periodo ?? '7d', sp.de, sp.ate);
  const kpis = await loadKpis(ctx.tenant.id, period.from, period.to);
  return <Reports kpis={kpis} base={await tenantBase()} preset={period.preset} />;
}
