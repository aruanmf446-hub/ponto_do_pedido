import { Reimbursements } from '@/apps/financeiro/pages/Reimbursements';
import { loadReimbursements, todayIn } from '@/apps/financeiro/queries';
import { requireApp } from '@/core/tenant/context';

export default async function ReembolsosRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'financeiro', '/financeiro/reembolsos');
  const data = await loadReimbursements(ctx.tenant.id);
  return <Reimbursements {...data} external={ctx.process_ownership.reembolsos === 'externo'} today={todayIn(ctx.tenant.timezone)} />;
}
