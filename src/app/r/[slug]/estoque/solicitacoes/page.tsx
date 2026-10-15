import { Requests } from '@/apps/estoque/pages/Requests';
import { loadRequests } from '@/apps/estoque/queries';
import { requireApp } from '@/core/tenant/context';

export default async function SolicitacoesRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'estoque', '/estoque/solicitacoes');
  const data = await loadRequests(ctx.tenant.id);
  return <Requests {...data} external={ctx.process_ownership.estoque === 'externo'} />;
}
