import type { ModelOption } from '@/core/ui/ModelPicker';

export const FINANCEIRO_MODELS: ModelOption[] = [
  {
    id: 'm1',
    name: 'Painel Financeiro Executivo',
    description: 'Saldo, a pagar e a receber em destaque, gráfico do período e pendências.',
    thumb: { bg: '#f5f3ee', surface: '#ffffff', ink: '#1f1c17', accent: '#8a5a2b', nav: 'sideDark', body: 'cards', top: '#2b241c' },
  },
  {
    id: 'm2',
    name: 'Agenda Financeira',
    description: 'Vencimentos em linha do tempo, cartões arredondados e navegação por ícones.',
    thumb: { bg: '#f3f1fb', surface: '#ffffff', ink: '#241f3a', accent: '#6d4ce0', nav: 'rail', body: 'list', top: '#241f3a' },
  },
  {
    id: 'm3',
    name: 'Escritório Contábil por Documentos',
    description: 'Cada lançamento parte do documento: pastas, notas, contratos e comprovantes.',
    thumb: { bg: '#f4f6f4', surface: '#ffffff', ink: '#14281c', accent: '#1d6b40', nav: 'side', body: 'table' },
  },
  {
    id: 'm4',
    name: 'Console de Aprovações e Pagamentos',
    description: 'Fila de decisões com ações rápidas de aprovar, recusar e pagar.',
    thumb: { bg: '#f2f5f8', surface: '#ffffff', ink: '#0e1116', accent: '#0f8a5f', nav: 'side', body: 'list' },
  },
];

export const FINANCEIRO_NAV = [
  { href: '/financeiro', label: 'Visão geral', icon: '◎', process: null },
  { href: '/financeiro/compras', label: 'Compras', icon: '⛁', process: 'compras' },
  { href: '/financeiro/pagar', label: 'Contas a pagar', icon: '↗', process: 'contas_pagar' },
  { href: '/financeiro/receber', label: 'Contas a receber', icon: '↙', process: 'contas_receber' },
  { href: '/financeiro/fluxo', label: 'Fluxo e conciliação', icon: '≋', process: 'conciliacao' },
  { href: '/financeiro/reembolsos', label: 'Reembolsos', icon: '↺', process: 'reembolsos' },
  { href: '/financeiro/orcamentos', label: 'Orçamentos', icon: '◔', process: 'orcamentos' },
  { href: '/financeiro/suprimentos', label: 'Suprimentos', icon: '▤', process: 'estoque' },
  { href: '/financeiro/fornecedores', label: 'Fornecedores', icon: '☰', process: 'fornecedores' },
  { href: '/financeiro/documentos', label: 'Documentos', icon: '▭', process: 'documentos' },
] as const;
