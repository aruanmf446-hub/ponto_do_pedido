import type { ModelOption } from '@/core/ui/ModelPicker';

export const FINANCEIRO_MODELS: ModelOption[] = [
  { id: 'm1', name: 'Escritório por Documentos', description: 'Pastas por área, papel claro e tipografia editorial; tudo parte do documento.' },
  { id: 'm2', name: 'Console de Aprovações', description: 'Fila de decisões em primeiro plano, tema escuro e alto contraste.' },
  { id: 'm3', name: 'Livro-Razão', description: 'Tabelas densas com pautas, números alinhados e totais em destaque.' },
  { id: 'm4', name: 'Agenda Financeira', description: 'Vencimentos em linha do tempo, cartões arredondados e navegação por ícones.' },
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
