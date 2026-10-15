import { notFound } from 'next/navigation';
import { Receipt } from '@/apps/caixa/pages/Static';
import { loadReceipt } from '@/apps/caixa/queries';
import { requireApp } from '@/core/tenant/context';

export default async function ReceiptRoute({ params }: { params: Promise<{ slug: string; paymentId: string }> }) {
  const { slug, paymentId } = await params;
  const ctx = await requireApp(slug, 'caixa');
  if (!/^[0-9a-f-]{36}$/.test(paymentId)) notFound();
  const payment = await loadReceipt(ctx.tenant.id, paymentId);
  if (!payment) notFound();
  return <Receipt payment={payment} tenantName={ctx.tenant.name} timezone={ctx.tenant.timezone} />;
}
