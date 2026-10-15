import type { IconName } from '@/core/ui/Icon';
import type { TemplateOption } from '@/core/ui/TemplateGallery';
import type { ThumbSpec } from '@/core/ui/ModelThumb';

/** Modelos do site institucional. O padrão vem de PDP_SITE_TEMPLATE; `/?modelo=mN` mostra uma prévia. */
export const SITE_TEMPLATES: TemplateOption[] = [
  {
    id: 'm1',
    name: 'Institucional Clássico',
    description: 'Claro e direto: mensagem principal, aplicativos em grade, princípios e planos.',
    thumb: { bg: '#fbfbfa', surface: '#ffffff', ink: '#111214', accent: '#1d4ed8', nav: 'top', body: 'cards' },
  },
  {
    id: 'm2',
    name: 'Vitrine de Aplicativos',
    description: 'Abertura escura com as telas dos aplicativos em destaque e cartões coloridos.',
    thumb: { bg: '#0b1020', surface: '#151b2e', ink: '#eef2ff', accent: '#7aa2ff', nav: 'top', body: 'hero', top: '#070b16' },
  },
  {
    id: 'm3',
    name: 'Editorial Gastronômico',
    description: 'Tipografia serifada, ilustrações de pratos de todas as cozinhas e leitura de revista.',
    thumb: { bg: '#f6f1e8', surface: '#fffaf2', ink: '#2a2118', accent: '#b5653a', nav: 'top', body: 'split' },
  },
  {
    id: 'm4',
    name: 'Conversão Direta',
    description: 'Benefícios em lista, planos logo no início e chamada final para assinar.',
    thumb: { bg: '#f4f7fb', surface: '#ffffff', ink: '#0f172a', accent: '#16a34a', nav: 'top', body: 'grid' },
  },
];

export const MODULE_ICON: Record<string, IconName> = {
  gestao: 'dashboard',
  atendimento: 'service',
  cozinha: 'chef',
  caixa: 'cash',
  cardapio: 'qr',
  delivery: 'truck',
  financeiro: 'chart',
  estoque: 'boxes',
};

/** Miniaturas das telas dos aplicativos usadas na vitrine (desenhadas, sem imagens externas). */
export const SHOWCASE: { label: string; thumb: ThumbSpec }[] = [
  { label: 'Gestão', thumb: { bg: '#f4f6fa', surface: '#ffffff', ink: '#14213d', accent: '#e0632e', nav: 'sideDark', body: 'cards', top: '#16213a' } },
  { label: 'Atendimento', thumb: { bg: '#f3eadb', surface: '#fffaf2', ink: '#2a2118', accent: '#e07a2e', nav: 'sideDark', body: 'map', top: '#1d1712' } },
  { label: 'Cozinha', thumb: { bg: '#121417', surface: '#1d2126', ink: '#eef1f4', accent: '#f0a020', nav: 'top', body: 'kanban', top: '#0c0e10' } },
  { label: 'Caixa', thumb: { bg: '#eef2fb', surface: '#ffffff', ink: '#16203a', accent: '#3b6cf6', nav: 'bottom', body: 'grid' } },
];
