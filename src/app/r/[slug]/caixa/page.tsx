import { OpenCash, ReceivablesList } from '@/apps/caixa/pages/Home';
import { loadOpenSession, loadReceivables } from '@/apps/caixa/queries';
import { requireApp } from '@/core/tenant/context';

export default async function CaixaHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'caixa');
  const session = await loadOpenSession(ctx.tenant.id, ctx.membership.user_id);
  if (!session) return <OpenCash />;
  return <ReceivablesList items={await loadReceivables(ctx.tenant.id)} />;
}
