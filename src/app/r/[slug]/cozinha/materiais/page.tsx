import { redirect } from 'next/navigation';
import { MaterialsRequest } from '@/apps/cozinha/Materials';
import { loadMaterials } from '@/apps/cozinha/queries';
import { can, hasModule, requireApp, tenantBase } from '@/core/tenant/context';

export default async function MaterialsRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'cozinha');
  if (!hasModule(ctx, 'estoque') || !can(ctx, 'estoque.solicitacao.criar') || ctx.process_ownership.estoque === 'externo') {
    redirect(`${await tenantBase()}/cozinha`);
  }
  const data = await loadMaterials(ctx.tenant.id);
  return <MaterialsRequest {...data} />;
}
