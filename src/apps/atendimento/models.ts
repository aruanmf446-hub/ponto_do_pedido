import type { ModelOption } from '@/core/ui/ModelPicker';

export const ATENDIMENTO_MODELS: ModelOption[] = [
  {
    id: 'm1',
    name: 'Menu Online',
    description: 'Categorias com ícones, cardápio em fotos e o pedido da mesa sempre ao lado.',
    thumb: { bg: '#fbf6ef', surface: '#ffffff', ink: '#2a2119', accent: '#e8552f', nav: 'side', body: 'menu' },
  },
  {
    id: 'm2',
    name: 'Mapa do Salão',
    description: 'Mesas desenhadas no salão com cadeiras e status; detalhes da mesa ao lado.',
    thumb: { bg: '#1c1915', surface: '#2a251f', ink: '#f2ebe1', accent: '#e8833a', nav: 'sideDark', body: 'map', top: '#151310' },
  },
  {
    id: 'm3',
    name: 'Comanda em Foco',
    description: 'Lista de comandas à esquerda e a comanda aberta em destaque.',
    thumb: { bg: '#fbf6ef', surface: '#ffffff', ink: '#2a2119', accent: '#e8552f', nav: 'top', body: 'split' },
  },
  {
    id: 'm4',
    name: 'Estação Premium',
    description: 'Tema escuro acolhedor para hospitalidade, com produtos em faixa e conta ao lado.',
    thumb: { bg: '#1f1a14', surface: '#2c251d', ink: '#f3e9da', accent: '#d9a441', nav: 'sideDark', body: 'menu', top: '#17130f' },
  },
];
