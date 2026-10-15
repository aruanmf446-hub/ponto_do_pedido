import type { Metadata } from 'next';
import { Landing } from '@/apps/plataforma/Landing';
import { isVisualModel } from '@/core/apps';
import { fetchPlans } from '@/core/billing';
import { config } from '@/core/config';

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

export default async function Home({ searchParams }: { searchParams: Promise<{ modelo?: string }> }) {
  const { modelo } = await searchParams;
  // Prévia de outro modelo por ?modelo=mN; o modelo publicado vem de PDP_SITE_TEMPLATE.
  const template = isVisualModel(modelo) ? modelo : isVisualModel(config.siteTemplate) ? config.siteTemplate : 'm1';
  const plans = await fetchPlans();
  return <Landing plans={plans} template={template} />;
}
