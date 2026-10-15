import { Entry } from '@/apps/estoque/pages/Entry';
import { loadEntry } from '@/apps/estoque/queries';
import { requireApp } from '@/core/tenant/context';

export default async function EntradaRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'estoque', '/estoque/entrada');
  const data = await loadEntry(ctx.tenant.id);
  return <Entry {...data} external={ctx.process_ownership.estoque === 'externo'} />;
}
