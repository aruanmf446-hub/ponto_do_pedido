import type { ModelOption } from '@/core/ui/ModelPicker';

export const COZINHA_MODELS: ModelOption[] = [
  {
    id: 'm1',
    name: 'Kanban de Pedidos',
    description: 'Colunas Recebidos, Em preparo, Prontos e Entregues em cartões claros.',
    thumb: { bg: '#f7f1e6', surface: '#ffffff', ink: '#2a2118', accent: '#e0532e', nav: 'top', body: 'kanban' },
  },
  {
    id: 'm2',
    name: 'Produção em Fila',
    description: 'Comandas em trilho horizontal (ticket rail), tema escuro e alto contraste.',
    thumb: { bg: '#121417', surface: '#1d2126', ink: '#eef1f4', accent: '#f0a020', nav: 'top', body: 'kanban', top: '#0c0e10' },
  },
  {
    id: 'm3',
    name: 'Estações de Preparo',
    description: 'Colunas coloridas pelas etapas da cozinha (ex.: Preparo, Montagem, Finalização).',
    thumb: { bg: '#f4f6f2', surface: '#ffffff', ink: '#1f2a22', accent: '#3c9a52', nav: 'top', body: 'kanban' },
  },
  {
    id: 'm4',
    name: 'Comando Minimalista',
    description: 'Um pedido em foco com cronômetro circular e a próxima fila ao lado.',
    thumb: { bg: '#14161a', surface: '#1f2328', ink: '#eceff3', accent: '#f2b33d', nav: 'rail', body: 'focus', top: '#0e1013' },
  },
];
