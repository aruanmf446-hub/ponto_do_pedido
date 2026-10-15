import { notFound } from 'next/navigation';
import { ChargeScreen } from '@/apps/caixa/pages/Charge';
import { loadCharge, loadOpenSession } from '@/apps/caixa/queries';
import { requireApp } from '@/core/tenant/context';

export default async function ChargeRoute({ params }: { params: Promise<{ slug: string; tabId: string }> }) {
  const { slug, tabId } = await params;
  const ctx = await requireApp(slug, 'caixa');
  if (!/^[0-9a-f-]{36}$/.test(tabId)) notFound();
  const [data, session] = await Promise.all([loadCharge(ctx.tenant.id, tabId), loadOpenSession(ctx.tenant.id, ctx.membership.user_id)]);
  if (!data.tab) notFound();
  return <ChargeScreen tab={data.tab} items={data.items} payments={data.payments} methods={data.methods} hasSession={!!session} />;
}
