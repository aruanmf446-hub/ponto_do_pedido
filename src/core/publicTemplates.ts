// Modelos visuais dos canais públicos. O restaurante escolhe na Gestão
// (tenants.settings.cardapio_template / delivery_template); o cliente final
// continua escolhendo apenas claro/escuro. Padrões: Cardápio m1, Delivery m2
// (identidade original de cada canal).
import { isVisualModel, type VisualModel } from '@/core/apps';
import type { TemplateOption } from '@/core/ui/TemplateGallery';

export const CARDAPIO_TEMPLATES: TemplateOption[] = [
  {
    id: 'm1',
    name: 'Cardápio QR Elegante',
    description: 'Painel de boas-vindas fixo ao lado e lista com fotos redondas, tipografia serifada.',
    thumb: { bg: '#f6efe4', surface: '#fffaf2', ink: '#3a2a1c', accent: '#b5653a', nav: 'none', body: 'split' },
  },
  {
    id: 'm2',
    name: 'Vitrine Vibrante',
    description: 'Banner colorido, categorias em ícones e cartões grandes com foto.',
    thumb: { bg: '#fff5ee', surface: '#ffffff', ink: '#2b1a12', accent: '#e8552b', nav: 'top', body: 'hero' },
  },
  {
    id: 'm3',
    name: 'Experiência Premium',
    description: 'Tema escuro, categorias na lateral e prato em destaque com acabamento dourado.',
    thumb: { bg: '#141210', surface: '#1f1b17', ink: '#f3e9d8', accent: '#c9a45c', nav: 'sideDark', body: 'focus', top: '#0e0c0a' },
  },
  {
    id: 'm4',
    name: 'Pedido Rápido Moderno',
    description: 'Categorias na lateral, grade compacta e pedido sempre visível ao lado.',
    thumb: { bg: '#f3f7f2', surface: '#ffffff', ink: '#1d2a1f', accent: '#2f9e58', nav: 'side', body: 'grid' },
  },
];

export const DELIVERY_TEMPLATES: TemplateOption[] = [
  {
    id: 'm1',
    name: 'Delivery Elegante',
    description: 'Apresentação da casa à esquerda e cardápio em lista com fotos redondas.',
    thumb: { bg: '#f6efe4', surface: '#fffaf2', ink: '#3a2a1c', accent: '#b5653a', nav: 'none', body: 'split' },
  },
  {
    id: 'm2',
    name: 'Delivery Vibrante',
    description: 'Banner chamativo, categorias em ícones e cartões grandes, cores quentes.',
    thumb: { bg: '#fff5ee', surface: '#ffffff', ink: '#2b1a12', accent: '#e8552b', nav: 'top', body: 'hero' },
  },
  {
    id: 'm3',
    name: 'Delivery Premium',
    description: 'Escuro e sofisticado, categorias na lateral e destaque para o prato.',
    thumb: { bg: '#141210', surface: '#1f1b17', ink: '#f3e9d8', accent: '#c9a45c', nav: 'sideDark', body: 'focus', top: '#0e0c0a' },
  },
  {
    id: 'm4',
    name: 'Pedido Rápido',
    description: 'Grade compacta com sacola fixa ao lado, ideal para quem já sabe o que quer.',
    thumb: { bg: '#f3f7f2', surface: '#ffffff', ink: '#1d2a1f', accent: '#2f9e58', nav: 'side', body: 'grid' },
  },
];

export type PublicTemplates = { cardapio: VisualModel; delivery: VisualModel };

export function parsePublicTemplates(value: unknown): PublicTemplates {
  const v = (value ?? {}) as Record<string, unknown>;
  return { cardapio: isVisualModel(v.cardapio) ? v.cardapio : 'm1', delivery: isVisualModel(v.delivery) ? v.delivery : 'm2' };
}
