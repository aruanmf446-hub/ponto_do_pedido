import { Suppliers } from '@/apps/financeiro/pages/Suppliers';
import { loadSuppliers } from '@/apps/financeiro/queries';
import { requireApp } from '@/core/tenant/context';

export default async function FornecedoresRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'financeiro', '/financeiro/fornecedores');
  const suppliers = await loadSuppliers(ctx.tenant.id);
  return <Suppliers suppliers={suppliers} external={ctx.process_ownership.fornecedores === 'externo'} />;
}
