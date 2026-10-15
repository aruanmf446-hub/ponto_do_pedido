import { Forbidden } from '@/apps/gestao/Forbidden';
import { HistoryPage } from '@/apps/gestao/pages/History';
import { loadHistory } from '@/apps/gestao/queries';
import { can, requireApp, tenantBase } from '@/core/tenant/context';

export default async function HistoryRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ modulo?: string; pagina?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireApp(slug, 'gestao');
  if (!can(ctx, 'gestao.historico.visualizar')) return <Forbidden />;
  const page = Math.max(0, Number(sp.pagina ?? 0) || 0);
  const moduleFilter = sp.modulo ?? null;
  const { rows, total } = await loadHistory(ctx.tenant.id, moduleFilter, page);
  return <HistoryPage rows={rows} total={total} page={page} module={moduleFilter} base={await tenantBase()} timezone={ctx.tenant.timezone} />;
}
