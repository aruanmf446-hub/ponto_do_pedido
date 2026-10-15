import { OpenCash } from '@/apps/caixa/pages/Home';
import { Movements } from '@/apps/caixa/pages/Session';
import { loadMovements, loadOpenSession } from '@/apps/caixa/queries';
import { rpcRead } from '@/core/rpc';
import { requireApp } from '@/core/tenant/context';

export default async function MovementsRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'caixa');
  const session = await loadOpenSession(ctx.tenant.id, ctx.membership.user_id);
  if (!session) return <OpenCash />;
  const [data, approvals] = await Promise.all([
    loadMovements(ctx.tenant.id, session.id),
    rpcRead<{ id: string; summary: string; status: string; can_execute: boolean }[]>('approvals_list', {
      p_tenant: ctx.tenant.id,
      p_module: 'caixa',
      p_only_actionable: false,
    }),
  ]);
  return <Movements {...data} approvals={approvals} />;
}
