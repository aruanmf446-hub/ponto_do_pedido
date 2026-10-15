import type { Metadata } from 'next';
import { Landing } from '@/apps/plataforma/Landing';
import { fetchPlans } from '@/core/billing';

export const metadata: Metadata = {
  title: { absolute: 'Ponto do Pedido — gestão para restaurantes' },
  description:
    'Atendimento, Cozinha, Caixa, Cardápio Digital, Delivery, Financeiro e Estoque em aplicativos independentes e integrados para restaurantes.',
  openGraph: {
    title: 'Ponto do Pedido',
    description: 'Cada área do restaurante no seu próprio aplicativo.',
    type: 'website',
    locale: 'pt_BR',
  },
};

export default async function Home() {
  const plans = await fetchPlans();
  return <Landing plans={plans} />;
}
