import { CounterOpen } from '@/apps/atendimento/pages/Simple';
import { requireApp } from '@/core/tenant/context';

export default async function CounterRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireApp(slug, 'atendimento');
  return <CounterOpen />;
}
