import { Floor } from '@/apps/atendimento/pages/Floor';
import { loadFloor } from '@/apps/atendimento/queries';
import { can, requireApp } from '@/core/tenant/context';

export default async function FloorRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'atendimento');
  const data = await loadFloor(ctx.tenant.id);
  return <Floor {...data} canOpen={can(ctx, 'atendimento.comanda.abrir')} canConfirmCustomer={can(ctx, 'atendimento.pedido.confirmar_cliente')} />;
}
