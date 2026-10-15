import { Lots } from '@/apps/estoque/pages/Lots';
import { loadLots, todayIn } from '@/apps/estoque/queries';
import { requireApp } from '@/core/tenant/context';

export default async function LotesRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'estoque', '/estoque/lotes');
  const data = await loadLots(ctx.tenant.id);
  return <Lots {...data} today={todayIn(ctx.tenant.timezone)} external={ctx.process_ownership.estoque === 'externo'} />;
}
