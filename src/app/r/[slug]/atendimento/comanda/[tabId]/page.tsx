import { notFound } from 'next/navigation';
import { TabWorkspace } from '@/apps/atendimento/pages/TabWorkspace';
import { loadFloor, loadMenu, loadTab } from '@/apps/atendimento/queries';
import { requireApp } from '@/core/tenant/context';

export default async function TabRoute({ params }: { params: Promise<{ slug: string; tabId: string }> }) {
  const { slug, tabId } = await params;
  const ctx = await requireApp(slug, 'atendimento');
  if (!/^[0-9a-f-]{36}$/.test(tabId)) notFound();
  const [{ tab, orders, payments, methods }, menu, floor] = await Promise.all([
    loadTab(ctx.tenant.id, tabId),
    loadMenu(ctx.tenant.id),
    loadFloor(ctx.tenant.id),
  ]);
  if (!tab || tab.channel === 'delivery') notFound();
  const occupied = new Set(floor.tabs.map((t) => t.table_id).filter(Boolean));
  const tableLabel = tab.table_id ? (floor.tables.find((t) => t.id === tab.table_id)?.label ?? null) : null;
  return (
    <TabWorkspace
      tab={tab}
      tableLabel={tableLabel}
      orders={orders}
      payments={payments}
      methods={methods}
      categories={menu.categories}
      products={menu.products}
      freeTables={floor.tables.filter((t) => !occupied.has(t.id)).map((t) => ({ id: t.id, label: t.label }))}
      openTabs={floor.tabs.map((t) => ({
        id: t.id,
        number: t.number,
        label: t.table_id ? `Mesa ${floor.tables.find((x) => x.id === t.table_id)?.label ?? ''}` : (t.customer_name ?? 'Balcão'),
        total_cents: t.total_cents,
        opened_at: t.opened_at,
      }))}
    />
  );
}
