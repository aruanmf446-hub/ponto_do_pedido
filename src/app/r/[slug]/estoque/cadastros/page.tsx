import { Registry } from '@/apps/estoque/pages/Registry';
import { loadRegistry } from '@/apps/estoque/queries';
import { requireApp } from '@/core/tenant/context';

export default async function CadastrosRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'estoque', '/estoque/cadastros');
  const data = await loadRegistry(ctx.tenant.id);
  return <Registry {...data} external={ctx.process_ownership.estoque === 'externo'} />;
}
