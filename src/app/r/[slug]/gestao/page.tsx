import Link from 'next/link';
import { Dashboard, periodFromSearch } from '@/apps/gestao/pages/Dashboard';
import { loadDashboardExtras, loadKpis } from '@/apps/gestao/queries';
import { PageHead } from '@/apps/gestao/ui';
import { businessDay } from '@/core/dates';
import { getUiPreference } from '@/core/prefs';
import { can, requireApp, tenantBase } from '@/core/tenant/context';

export default async function GestaoHome({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireApp(slug, 'gestao');
  const base = await tenantBase();
  if (!can(ctx, 'gestao.indicadores.visualizar')) {
    return (
      <>
        <PageHead title="Gestão" subtitle={`Olá, ${ctx.membership.display_name}. Use o menu para as funções autorizadas.`} />
        <p className="gs-meta">
          Indicadores não estão disponíveis para seu perfil. <Link href={`${base}/gestao/aprovacoes`}>Ver aprovações</Link>
        </p>
      </>
    );
  }
  const today = businessDay(new Date(), ctx.tenant.timezone, ctx.tenant.business_day_start_hour);
  const period = periodFromSearch(today, sp.periodo, sp.de, sp.ate);
  const [kpis, extras, pref] = await Promise.all([
    loadKpis(ctx.tenant.id, period.from, period.to),
    loadDashboardExtras(ctx.tenant.id),
    getUiPreference(ctx.tenant.id, 'gestao'),
  ]);
  return <Dashboard ctx={ctx} kpis={kpis} extras={extras} base={base} preset={period.preset} model={pref.model} />;
}
