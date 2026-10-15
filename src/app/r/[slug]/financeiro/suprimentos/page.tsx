import { redirect } from 'next/navigation';
import { Supplies } from '@/apps/financeiro/pages/Supplies';
import { loadSupplies } from '@/apps/financeiro/queries';
import { requireApp, tenantBase } from '@/core/tenant/context';

export default async function SuprimentosRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'financeiro', '/financeiro/suprimentos');
  if (ctx.process_ownership.estoque === 'externo') redirect(`${await tenantBase()}/financeiro`);
  const data = await loadSupplies(ctx.tenant.id);
  return <Supplies {...data} />;
}
