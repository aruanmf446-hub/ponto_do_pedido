import { Documents } from '@/apps/financeiro/pages/Documents';
import { loadDocuments, todayIn } from '@/apps/financeiro/queries';
import { requireApp } from '@/core/tenant/context';

export default async function DocumentosRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'financeiro', '/financeiro/documentos');
  const data = await loadDocuments(ctx.tenant.id);
  return <Documents {...data} external={ctx.process_ownership.documentos === 'externo'} today={todayIn(ctx.tenant.timezone)} />;
}
