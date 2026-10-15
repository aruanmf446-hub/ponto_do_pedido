import { Purchases } from '@/apps/financeiro/pages/Purchases';
import { loadPurchases } from '@/apps/financeiro/queries';
import { requireApp } from '@/core/tenant/context';

export default async function ComprasRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'financeiro', '/financeiro/compras');
  const data = await loadPurchases(ctx.tenant.id);
  return <Purchases {...data} external={ctx.process_ownership.compras === 'externo'} stockInternal={ctx.process_ownership.estoque !== 'externo'} />;
}
