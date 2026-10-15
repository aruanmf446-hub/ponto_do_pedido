import { PaymentsPage } from '@/apps/gestao/pages/Payments';
import { loadPayments } from '@/apps/gestao/queries';
import { hasModule, requireApp } from '@/core/tenant/context';

export default async function PaymentsRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'gestao');
  const data = await loadPayments(ctx.tenant.id);
  return <PaymentsPage {...data} hasDelivery={hasModule(ctx, 'delivery')} />;
}
