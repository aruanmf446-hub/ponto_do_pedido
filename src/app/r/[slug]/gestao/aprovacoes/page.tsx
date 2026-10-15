import { ApprovalsPage, type ApprovalItem } from '@/apps/gestao/pages/Approvals';
import { rpcRead } from '@/core/rpc';
import { requireApp } from '@/core/tenant/context';

export default async function ApprovalsRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'gestao');
  const items = await rpcRead<ApprovalItem[]>('approvals_list', { p_tenant: ctx.tenant.id, p_module: null, p_only_actionable: false });
  return <ApprovalsPage items={items} />;
}
