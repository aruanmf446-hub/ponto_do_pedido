import { Payables } from '@/apps/financeiro/pages/Payables';
import { loadPayables, todayIn } from '@/apps/financeiro/queries';
import { requireApp } from '@/core/tenant/context';

export default async function PagarRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'financeiro', '/financeiro/pagar');
  const data = await loadPayables(ctx.tenant.id);
  return <Payables {...data} external={ctx.process_ownership.contas_pagar === 'externo'} today={todayIn(ctx.tenant.timezone)} />;
}
