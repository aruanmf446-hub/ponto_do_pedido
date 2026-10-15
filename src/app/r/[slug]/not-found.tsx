import { AccessFrame } from '@/apps/acesso/Frame';

export default function TenantNotFound() {
  return (
    <AccessFrame tenantName="Ponto do Pedido" logoPath={null} title="Estabelecimento não encontrado">
      <p>Confira o endereço informado. Cada restaurante possui seu próprio endereço no Ponto do Pedido.</p>
    </AccessFrame>
  );
}
