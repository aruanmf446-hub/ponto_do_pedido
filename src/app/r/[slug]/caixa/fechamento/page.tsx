import { OpenCash } from '@/apps/caixa/pages/Home';
import { Closing } from '@/apps/caixa/pages/Session';
import { loadExpected, loadOpenSession } from '@/apps/caixa/queries';
import { requireApp } from '@/core/tenant/context';

export default async function ClosingRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'caixa');
  const session = await loadOpenSession(ctx.tenant.id, ctx.membership.user_id);
  if (!session) return <OpenCash />;
  const expected = await loadExpected(ctx.tenant.id, session.id);
  return <Closing sessionId={session.id} expected={expected} openedAt={session.opened_at} />;
}
