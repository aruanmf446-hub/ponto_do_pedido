import type { IconName } from '@/core/ui/Icon';
import type { ModelOption } from '@/core/ui/ModelPicker';

export const FINANCEIRO_MODELS: ModelOption[] = [
  {
    id: 'm1',
    name: 'Painel Financeiro Executivo',
    description: 'Indicadores com ícones, gráfico de 14 dias, próximos vencimentos e pendências.',
    thumb: { bg: '#f4f6f9', surface: '#ffffff', ink: '#14213d', accent: '#0f766e', nav: 'side', body: 'cards' },
  },
  {
    id: 'm2',
    name: 'Agenda Financeira',
    description: 'Semana em destaque e vencimentos em linha do tempo, com navegação no topo.',
    thumb: { bg: '#f4f2fc', surface: '#ffffff', ink: '#241f3a', accent: '#6d4ce0', nav: 'top', body: 'list' },
  },
  {
    id: 'm3',
    name: 'Escritório Contábil por Documentos',
    description: 'Pastas por processo, documentos arquivados e razão diário em tabela.',
    thumb: { bg: '#f3f5f1', surface: '#ffffff', ink: '#14281c', accent: '#1d6b40', nav: 'side', body: 'table' },
  },
  {
    id: 'm4',
    name: 'Console de Aprovações e Pagamentos',
    description: 'Fila de decisões em tabela com status e ação direta, barra lateral escura.',
    thumb: { bg: '#eef1f5', surface: '#ffffff', ink: '#0e1116', accent: '#10a36f', nav: 'sideDark', body: 'table', top: '#0f172a' },
  },
];

export const FINANCEIRO_NAV = [
  { href: '/financeiro', label: 'Visão geral', icon: 'dashboard', process: null },
  { href: '/financeiro/compras', label: 'Compras', icon: 'bag', process: 'compras' },
  { href: '/financeiro/pagar', label: 'Contas a pagar', icon: 'arrow-up-right', process: 'contas_pagar' },
  { href: '/financeiro/receber', label: 'Contas a receber', icon: 'coins', process: 'contas_receber' },
  { href: '/financeiro/fluxo', label: 'Fluxo e conciliação', icon: 'activity', process: 'conciliacao' },
  { href: '/financeiro/reembolsos', label: 'Reembolsos', icon: 'undo', process: 'reembolsos' },
  { href: '/financeiro/orcamentos', label: 'Orçamentos', icon: 'pie', process: 'orcamentos' },
  { href: '/financeiro/suprimentos', label: 'Suprimentos', icon: 'boxes', process: 'estoque' },
  { href: '/financeiro/fornecedores', label: 'Fornecedores', icon: 'building', process: 'fornecedores' },
  { href: '/financeiro/documentos', label: 'Documentos', icon: 'folder', process: 'documentos' },
] as const satisfies readonly { href: string; label: string; icon: IconName; process: string | null }[];
