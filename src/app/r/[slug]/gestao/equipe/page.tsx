import { Forbidden } from '@/apps/gestao/Forbidden';
import { TeamPage } from '@/apps/gestao/pages/Team';
import { loadTeam } from '@/apps/gestao/queries';
import { absoluteTenantUrl, can, requireApp } from '@/core/tenant/context';

export default async function TeamRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'gestao');
  if (!can(ctx, 'gestao.equipe.visualizar')) return <Forbidden />;
  const data = await loadTeam(ctx.tenant.id);
  return <TeamPage {...data} rootUrl={await absoluteTenantUrl('/')} />;
}
