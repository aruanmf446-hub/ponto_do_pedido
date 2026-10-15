import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Tracking } from '@/apps/delivery/actions';
import { DeliveryFrame } from '@/apps/delivery/Frame';
import { TrackingView } from '@/apps/delivery/TrackingView';
import { parsePublicTemplates } from '@/core/publicTemplates';
import { rpcRead } from '@/core/rpc';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Acompanhar pedido', robots: { index: false, follow: false } };

export default async function TrackingRoute({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  if (!/^[a-f0-9]{20,64}$/.test(token)) notFound();
  const [tracking, templates] = await Promise.all([rpcRead<Tracking>('public_delivery_tracking', { p_token: token }), rpcRead<unknown>('public_templates', { p_slug: slug })]);
  if (!tracking) notFound();
  return (
    <DeliveryFrame name={tracking.tenant.name} logoPath={tracking.tenant.logo_path} template={parsePublicTemplates(templates).delivery}>
      <TrackingView token={token} initial={tracking} timezone="America/Sao_Paulo" />
    </DeliveryFrame>
  );
}
