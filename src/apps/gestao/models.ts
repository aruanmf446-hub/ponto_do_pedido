import type { ModelOption } from '@/core/ui/ModelPicker';

export const GESTAO_MODELS: ModelOption[] = [
  { id: 'm1', name: 'Centro de Comando', description: 'Menu lateral escuro, painéis densos e destaque em laranja.' },
  { id: 'm2', name: 'Workspace Editorial', description: 'Navegação superior, tipografia serifada e muito respiro.' },
  { id: 'm3', name: 'Suíte Empresarial', description: 'Cabeçalho corporativo, menu agrupado por seções e trilha de navegação.' },
  { id: 'm4', name: 'Sala de Controle', description: 'Trilho de ícones, módulos em blocos e tema noturno.' },
];

export type GestaoNavItem = { href: string; label: string; icon: string; group: 'Visão' | 'Restaurante' | 'Pessoas' | 'Operação' | 'Controle'; permission?: string };

export const GESTAO_NAV: GestaoNavItem[] = [
  { href: '/gestao', label: 'Painel', icon: '◧', group: 'Visão', permission: 'gestao.indicadores.visualizar' },
  { href: '/gestao/relatorios', label: 'Relatórios', icon: '▤', group: 'Visão', permission: 'gestao.indicadores.visualizar' },
  { href: '/gestao/restaurante', label: 'Restaurante', icon: '⌂', group: 'Restaurante' },
  { href: '/gestao/licencas', label: 'Licenças', icon: '◈', group: 'Restaurante', permission: 'gestao.licencas.visualizar' },
  { href: '/gestao/equipe', label: 'Equipe', icon: '◉', group: 'Pessoas', permission: 'gestao.equipe.visualizar' },
  { href: '/gestao/funcoes', label: 'Funções e permissões', icon: '⚿', group: 'Pessoas', permission: 'gestao.permissoes.alterar' },
  { href: '/gestao/aprovacoes', label: 'Aprovações', icon: '✓', group: 'Pessoas' },
  { href: '/gestao/mesas', label: 'Mesas e setores', icon: '▦', group: 'Operação' },
  { href: '/gestao/cardapio', label: 'Produtos', icon: '❖', group: 'Operação' },
  { href: '/gestao/pagamentos', label: 'Pagamentos e taxas', icon: '¤', group: 'Operação' },
  { href: '/gestao/operacao', label: 'Configurações', icon: '⚙', group: 'Operação', permission: 'gestao.operacao.alterar' },
  { href: '/gestao/historico', label: 'Histórico', icon: '↺', group: 'Controle', permission: 'gestao.historico.visualizar' },
];
