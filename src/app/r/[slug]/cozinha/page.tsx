import { KitchenBoard } from '@/apps/cozinha/Board';
import { loadKitchen } from '@/apps/cozinha/queries';
import { requireApp } from '@/core/tenant/context';

export default async function KitchenRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'cozinha');
  const { orders, unavailable } = await loadKitchen(ctx.tenant.id);
  const stages = Array.isArray(ctx.tenant.settings.kitchen_stages) ? (ctx.tenant.settings.kitchen_stages as string[]) : [];
  return <KitchenBoard orders={orders} unavailable={unavailable} stages={stages} />;
}
