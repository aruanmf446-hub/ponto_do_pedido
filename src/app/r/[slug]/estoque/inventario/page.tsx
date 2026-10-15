import { Inventory } from '@/apps/estoque/pages/Inventory';
import { loadInventory } from '@/apps/estoque/queries';
import { requireApp } from '@/core/tenant/context';

export default async function InventarioRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'estoque', '/estoque/inventario');
  const data = await loadInventory(ctx.tenant.id);
  return <Inventory {...data} external={ctx.process_ownership.estoque === 'externo'} />;
}
