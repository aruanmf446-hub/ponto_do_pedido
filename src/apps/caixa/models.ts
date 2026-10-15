import type { ModelOption } from '@/core/ui/ModelPicker';

export const CAIXA_MODELS: ModelOption[] = [
  {
    id: 'm1',
    name: 'Minimalista Elegante',
    description: 'Muito respiro, números grandes e somente o essencial para receber.',
    thumb: { bg: '#f7f5f2', surface: '#ffffff', ink: '#1c1b19', accent: '#1c1b19', nav: 'top', body: 'split' },
  },
  {
    id: 'm2',
    name: 'Terminal Dark',
    description: 'Tela escura de alto contraste, atalhos de teclado e fonte monoespaçada.',
    thumb: { bg: '#0d1110', surface: '#161c1a', ink: '#d8f3e6', accent: '#2ee08a', nav: 'side', body: 'split', top: '#0a0d0c' },
  },
  {
    id: 'm3',
    name: 'Touch Moderno',
    description: 'Botões grandes para toque, teclado numérico e navegação inferior.',
    thumb: { bg: '#eef2fb', surface: '#ffffff', ink: '#16203a', accent: '#3b6cf6', nav: 'bottom', body: 'grid' },
  },
  {
    id: 'm4',
    name: 'Clássico Profissional',
    description: 'Janela de sistema com barras, tabelas e barra de status do operador.',
    thumb: { bg: '#e3e7ee', surface: '#ffffff', ink: '#1a2333', accent: '#1f4e9a', nav: 'top', body: 'table', top: '#1f4e9a' },
  },
];
