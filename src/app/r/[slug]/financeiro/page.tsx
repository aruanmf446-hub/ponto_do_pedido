import { Overview } from '@/apps/financeiro/pages/Overview';
import { loadOverview } from '@/apps/financeiro/queries';
import { getUiPreference } from '@/core/prefs';
import { requireApp, tenantBase } from '@/core/tenant/context';

export default async function FinanceiroHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'financeiro');
  const [data, pref, base] = await Promise.all([loadOverview(ctx.tenant.id, ctx.tenant.timezone), getUiPreference(ctx.tenant.id, 'financeiro'), tenantBase()]);
  return <Overview data={data} model={pref.model} base={base} />;
}
