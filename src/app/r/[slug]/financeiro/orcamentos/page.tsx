import { Budgets } from '@/apps/financeiro/pages/Budgets';
import { loadBudgets, todayIn } from '@/apps/financeiro/queries';
import { requireApp } from '@/core/tenant/context';

export default async function OrcamentosRoute({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { slug } = await params;
  const { mes } = await searchParams;
  const ctx = await requireApp(slug, 'financeiro', '/financeiro/orcamentos');
  const month = `${mes && /^\d{4}-\d{2}$/.test(mes) ? mes : todayIn(ctx.tenant.timezone).slice(0, 7)}-01`;
  const rows = await loadBudgets(ctx.tenant.id, month);
  return <Budgets month={month} rows={rows} external={ctx.process_ownership.orcamentos === 'externo'} />;
}
