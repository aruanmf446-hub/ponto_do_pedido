import { CashFlow } from '@/apps/financeiro/pages/CashFlow';
import { loadCashFlow, todayIn } from '@/apps/financeiro/queries';
import { addDays } from '@/core/dates';
import { requireApp } from '@/core/tenant/context';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function FluxoRoute({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ de?: string; ate?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireApp(slug, 'financeiro', '/financeiro/fluxo');
  const today = todayIn(ctx.tenant.timezone);
  let to = sp.ate && ISO.test(sp.ate) ? sp.ate : today;
  let from = sp.de && ISO.test(sp.de) ? sp.de : addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  if (addDays(from, 366) < to) from = addDays(to, -366);
  const data = await loadCashFlow(ctx.tenant.id, from, to);
  return <CashFlow from={from} to={to} {...data} external={ctx.process_ownership.conciliacao === 'externo'} />;
}
