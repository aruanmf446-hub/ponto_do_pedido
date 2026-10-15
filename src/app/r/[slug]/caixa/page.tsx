import { OpenCash, ReceivablesList } from '@/apps/caixa/pages/Home';
import { loadExpected, loadOpenSession, loadReceivables } from '@/apps/caixa/queries';
import { requireApp } from '@/core/tenant/context';

export default async function CaixaHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'caixa');
  const session = await loadOpenSession(ctx.tenant.id, ctx.membership.user_id);
  if (!session) return <OpenCash />;
  const [items, expected] = await Promise.all([loadReceivables(ctx.tenant.id), loadExpected(ctx.tenant.id, session.id).catch(() => null)]);
  return <ReceivablesList items={items} expected={expected} />;
}
