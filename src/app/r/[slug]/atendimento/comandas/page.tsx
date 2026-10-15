import { TabsList } from '@/apps/atendimento/pages/Simple';
import { loadFloor } from '@/apps/atendimento/queries';
import { requireApp } from '@/core/tenant/context';

export default async function TabsRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'atendimento');
  const { tabs, tables } = await loadFloor(ctx.tenant.id);
  return <TabsList tabs={tabs} tableLabels={Object.fromEntries(tables.map((t) => [t.id, t.label]))} />;
}
