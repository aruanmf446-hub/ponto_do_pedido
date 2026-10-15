import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { DeliveryMenu } from '@/apps/delivery/actions';
import { DeliveryFrame } from '@/apps/delivery/Frame';
import { Storefront } from '@/apps/delivery/Storefront';
import { rpcRead } from '@/core/rpc';
import { tenantBase } from '@/core/tenant/context';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const menu = await rpcRead<DeliveryMenu>('public_delivery_menu', { p_slug: slug });
  return { title: menu.tenant ? `Delivery · ${menu.tenant.name}` : 'Delivery', description: 'Peça e acompanhe sua entrega.' };
}

export default async function DeliveryRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const menu = await rpcRead<DeliveryMenu>('public_delivery_menu', { p_slug: slug });
  if (menu.state === 'not_found' || !menu.tenant) notFound();
  if (menu.state !== 'ok') {
    return (
      <DeliveryFrame name={menu.tenant.name} logoPath={menu.tenant.logo_path}>
        <div className="dl-closed">
          <h1>Delivery indisponível</h1>
          <p className="dl-muted">Este restaurante não está recebendo pedidos de entrega no momento.</p>
        </div>
      </DeliveryFrame>
    );
  }
  return (
    <DeliveryFrame name={menu.tenant.name} logoPath={menu.tenant.logo_path}>
      <Storefront slug={slug} menu={menu} base={await tenantBase()} />
    </DeliveryFrame>
  );
}
