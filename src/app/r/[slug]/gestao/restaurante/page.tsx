import { RestaurantPage } from '@/apps/gestao/pages/Restaurant';
import { loadTenant } from '@/apps/gestao/queries';
import { absoluteTenantUrl, can, canRequest, hasModule, requireApp } from '@/core/tenant/context';

export default async function RestaurantRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'gestao');
  const { tenant, hours } = await loadTenant(ctx.tenant.id);
  const links = [{ label: 'Acesso da equipe', url: await absoluteTenantUrl('/') }];
  if (hasModule(ctx, 'cardapio')) links.push({ label: 'Cardápio (consulta)', url: await absoluteTenantUrl('/cardapio') });
  if (hasModule(ctx, 'delivery')) links.push({ label: 'Delivery', url: await absoluteTenantUrl('/delivery') });
  const canEdit = can(ctx, 'gestao.restaurante.alterar') || canRequest(ctx, 'gestao.restaurante.alterar');
  const canEditHours = can(ctx, 'cadastros.horarios.alterar') || canRequest(ctx, 'cadastros.horarios.alterar');
  return <RestaurantPage tenant={tenant} hours={hours} canEdit={canEdit} canEditHours={canEditHours} publicLinks={links} />;
}
