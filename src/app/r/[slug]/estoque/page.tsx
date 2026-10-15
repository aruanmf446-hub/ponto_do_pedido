import { Overview } from '@/apps/estoque/pages/Overview';
import { loadOverview, todayIn } from '@/apps/estoque/queries';
import { getUiPreference } from '@/core/prefs';
import { requireApp, tenantBase } from '@/core/tenant/context';

export default async function EstoqueHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'estoque');
  const [data, pref, base] = await Promise.all([loadOverview(ctx.tenant.id), getUiPreference(ctx.tenant.id, 'estoque'), tenantBase()]);
  return <Overview data={data} model={pref.model} base={base} today={todayIn(ctx.tenant.timezone)} timezone={ctx.tenant.timezone} />;
}
