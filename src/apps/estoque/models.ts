import type { ModelOption } from '@/core/ui/ModelPicker';

export const ESTOQUE_MODELS: ModelOption[] = [
  { id: 'm1', name: 'Controle Industrial', description: 'Painel de chão de fábrica: saldos com medidores, sinais de alerta e grafite com amarelo.' },
  { id: 'm2', name: 'Lotes e Validade', description: 'Tudo organizado pelo vencimento: faixas de risco e lotes em fita colorida.' },
  { id: 'm3', name: 'Conferência', description: 'Prancheta de inventário: listas de checagem, contagens grandes e foco na divergência.' },
  { id: 'm4', name: 'Solicitações e Movimentos', description: 'Fluxo de pedidos dos setores e linha do tempo das movimentações.' },
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
