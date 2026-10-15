import type { IconName } from '@/core/ui/Icon';
import type { ModelOption } from '@/core/ui/ModelPicker';

export const GESTAO_MODELS: ModelOption[] = [
  {
    id: 'm1',
    name: 'Centro de Comando Corporativo',
    description: 'Menu lateral escuro, indicadores com ícones, gráficos e atividade da equipe.',
    thumb: { bg: '#f4f1ec', surface: '#ffffff', ink: '#1d1a17', accent: '#ea6a2c', nav: 'sideDark', body: 'cards', top: '#1f1c19' },
  },
  {
    id: 'm2',
    name: 'Workspace Editorial Refinado',
    description: 'Navegação no topo, tipografia editorial, ilustração e listas elegantes.',
    thumb: { bg: '#fbf7f0', surface: '#ffffff', ink: '#2b241c', accent: '#c46a2b', nav: 'top', body: 'hero' },
  },
  {
    id: 'm3',
    name: 'Suíte Administrativa Empresarial',
    description: 'Visual corporativo claro, trilha de navegação e painéis organizados.',
    thumb: { bg: '#f3f6fb', surface: '#ffffff', ink: '#16233b', accent: '#2457c5', nav: 'side', body: 'table' },
  },
  {
    id: 'm4',
    name: 'Sala de Controle Operacional',
    description: 'Tema escuro modular, blocos de status, aprovações e alertas em tempo real.',
    thumb: { bg: '#0f1720', surface: '#18232f', ink: '#e6edf5', accent: '#2fbf71', nav: 'sideDark', body: 'feed', top: '#0b1118' },
  },
];

export type GestaoNavItem = { href: string; label: string; icon: IconName; group: 'Visão' | 'Restaurante' | 'Pessoas' | 'Operação' | 'Controle'; permission?: string };

export const GESTAO_NAV: GestaoNavItem[] = [
  { href: '/gestao', label: 'Painel', icon: 'dashboard', group: 'Visão', permission: 'gestao.indicadores.visualizar' },
  { href: '/gestao/relatorios', label: 'Relatórios', icon: 'chart', group: 'Visão', permission: 'gestao.indicadores.visualizar' },
  { href: '/gestao/restaurante', label: 'Restaurante', icon: 'store', group: 'Restaurante' },
  { href: '/gestao/licencas', label: 'Licenças', icon: 'badge', group: 'Restaurante', permission: 'gestao.licencas.visualizar' },
  { href: '/gestao/equipe', label: 'Equipe', icon: 'users', group: 'Pessoas', permission: 'gestao.equipe.visualizar' },
  { href: '/gestao/funcoes', label: 'Funções e permissões', icon: 'shield', group: 'Pessoas', permission: 'gestao.permissoes.alterar' },
  { href: '/gestao/aprovacoes', label: 'Aprovações', icon: 'approvals', group: 'Pessoas' },
  { href: '/gestao/mesas', label: 'Mesas e setores', icon: 'armchair', group: 'Operação' },
  { href: '/gestao/cardapio', label: 'Produtos', icon: 'menu', group: 'Operação' },
  { href: '/gestao/pagamentos', label: 'Pagamentos e taxas', icon: 'card', group: 'Operação' },
  { href: '/gestao/operacao', label: 'Configurações', icon: 'settings', group: 'Operação', permission: 'gestao.operacao.alterar' },
  { href: '/gestao/historico', label: 'Histórico', icon: 'history', group: 'Controle', permission: 'gestao.historico.visualizar' },
];
