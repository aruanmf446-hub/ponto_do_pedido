import { Receivables } from '@/apps/financeiro/pages/Receivables';
import { loadReceivables, todayIn } from '@/apps/financeiro/queries';
import { requireApp } from '@/core/tenant/context';

export default async function ReceberRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'financeiro', '/financeiro/receber');
  const rows = await loadReceivables(ctx.tenant.id);
  return <Receivables rows={rows} external={ctx.process_ownership.contas_receber === 'externo'} today={todayIn(ctx.tenant.timezone)} />;
}
