import { AtApprovals } from '@/apps/atendimento/pages/Simple';
import { rpcRead } from '@/core/rpc';
import { requireApp } from '@/core/tenant/context';

export default async function AtApprovalsRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'atendimento');
  const items = await rpcRead<Parameters<typeof AtApprovals>[0]['items']>('approvals_list', {
    p_tenant: ctx.tenant.id,
    p_module: 'atendimento',
    p_only_actionable: false,
  });
  return <AtApprovals items={items} />;
}
