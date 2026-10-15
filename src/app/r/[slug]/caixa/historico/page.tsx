import { CashHistory } from '@/apps/caixa/pages/Static';
import { loadHistory } from '@/apps/caixa/queries';
import { requireApp } from '@/core/tenant/context';

export default async function CashHistoryRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'caixa');
  return <CashHistory sessions={await loadHistory(ctx.tenant.id)} timezone={ctx.tenant.timezone} />;
}
