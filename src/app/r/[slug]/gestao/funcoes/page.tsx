import { Forbidden } from '@/apps/gestao/Forbidden';
import { RolesPage } from '@/apps/gestao/pages/Roles';
import { loadRoles } from '@/apps/gestao/queries';
import { can, canRequest, requireApp } from '@/core/tenant/context';

export default async function RolesRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'gestao');
  if (!can(ctx, 'gestao.permissoes.alterar') && !canRequest(ctx, 'gestao.permissoes.alterar')) return <Forbidden />;
  const data = await loadRoles(ctx.tenant.id);
  return <RolesPage {...data} modules={ctx.modules} />;
}
