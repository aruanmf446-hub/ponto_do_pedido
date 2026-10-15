import type { IconName } from '@/core/ui/Icon';
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
    description: 'Tudo pelo vencimento: navegação no topo, filtros laterais e lotes por data.',
    thumb: { bg: '#f6f8f3', surface: '#ffffff', ink: '#1f2a1a', accent: '#5a9a2f', nav: 'top', body: 'split' },
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
    description: 'Painel de solicitação, pedidos dos setores em tabela e movimentações recentes.',
    thumb: { bg: '#f1f5fb', surface: '#ffffff', ink: '#182233', accent: '#2563eb', nav: 'top', body: 'split' },
  },
];

export const ESTOQUE_NAV = [
  { href: '/estoque', label: 'Saldos', icon: 'boxes' },
  { href: '/estoque/lotes', label: 'Lotes e validade', icon: 'calendar' },
  { href: '/estoque/entrada', label: 'Entradas', icon: 'package-check' },
  { href: '/estoque/solicitacoes', label: 'Solicitações', icon: 'clipboard' },
  { href: '/estoque/inventario', label: 'Inventário', icon: 'checklist' },
  { href: '/estoque/movimentos', label: 'Movimentações', icon: 'transfer' },
  { href: '/estoque/cadastros', label: 'Materiais e locais', icon: 'settings' },
] as const satisfies readonly { href: string; label: string; icon: IconName }[];
