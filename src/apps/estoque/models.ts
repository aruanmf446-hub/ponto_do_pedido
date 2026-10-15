import type { ModelOption } from '@/core/ui/ModelPicker';

export const ESTOQUE_MODELS: ModelOption[] = [
  {
    id: 'm1',
    name: 'Controle de Estoque Industrial',
    description: 'Indicadores com ícones e tabela de materiais com nível, mínimo e situação.',
    thumb: { bg: '#f3f5f4', surface: '#ffffff', ink: '#17201c', accent: '#2f7d5b', nav: 'side', body: 'table' },
  },
  {
    id: 'm2',
    name: 'Lotes e Validade',
    description: 'Tudo pelo vencimento: filtros laterais, faixas de risco e lotes por data.',
    thumb: { bg: '#fbfaf7', surface: '#ffffff', ink: '#262219', accent: '#d9480f', nav: 'top', body: 'table' },
  },
  {
    id: 'm3',
    name: 'Conferência e Inventário',
    description: 'Tema escuro de prancheta, etapas da contagem e foco nas divergências.',
    thumb: { bg: '#12171a', surface: '#1b2226', ink: '#e4ecef', accent: '#3fb68b', nav: 'sideDark', body: 'list', top: '#0d1113' },
  },
  {
    id: 'm4',
    name: 'Solicitações e Movimentações',
    description: 'Pedidos dos setores, situação de cada um e linha do tempo do estoque.',
    thumb: { bg: '#f1f5fb', surface: '#ffffff', ink: '#182233', accent: '#2563eb', nav: 'top', body: 'feed' },
  },
];

export const ESTOQUE_NAV = [
  { href: '/estoque', label: 'Saldos', icon: '▦' },
  { href: '/estoque/lotes', label: 'Lotes e validade', icon: '⧗' },
  { href: '/estoque/entrada', label: 'Entradas', icon: '⇣' },
  { href: '/estoque/solicitacoes', label: 'Solicitações', icon: '✎' },
  { href: '/estoque/inventario', label: 'Inventário', icon: '☑' },
  { href: '/estoque/movimentos', label: 'Movimentações', icon: '⇄' },
  { href: '/estoque/cadastros', label: 'Materiais e locais', icon: '⚙' },
] as const;
