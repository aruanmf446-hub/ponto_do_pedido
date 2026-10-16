// Conteúdo institucional (sem preços: valores vêm do projeto `assinaturas`).

export const MODULES = [
  {
    id: 'gestao',
    name: 'Gestão',
    text: 'Restaurante, equipe, funções, permissões, delegações, aprovações, cadastros, indicadores e histórico.',
  },
  {
    id: 'atendimento',
    name: 'Atendimento',
    text: 'Mesas, comandas e pedidos com cardápio rápido. Envio à cozinha, entrega e fechamento da conta.',
  },
  { id: 'cozinha', name: 'Cozinha', text: 'Fila de produção em Kanban, etapas de preparo, indisponibilidade e retirada.' },
  {
    id: 'caixa',
    name: 'Caixa',
    text: 'Abertura, recebimentos, pagamentos divididos, troco, sangrias, conferência e fechamento do turno.',
  },
  { id: 'cardapio', name: 'Cardápio Digital', text: 'QR Code próprio por mesa: consulta ou pedido pelo cliente, conforme sua regra.' },
  { id: 'delivery', name: 'Delivery', text: 'Link próprio para pedidos de entrega com taxa por região e acompanhamento.' },
  {
    id: 'financeiro',
    name: 'Administrativo e Financeiro',
    text: 'Compras com cotação e aprovação, contas a pagar e receber, documentos, orçamentos e conciliação.',
  },
  {
    id: 'estoque',
    name: 'Estoque',
    text: 'Lotes, validades, localizações, inventário, solicitações de material e rastreabilidade.',
  },
] as const;

export const PRINCIPLES = [
  { title: 'Um aplicativo para cada função', text: 'Cada área trabalha na própria tela, com navegação e identidade próprias.' },
  { title: 'Autoridade sob controle', text: 'O titular define quem faz o quê, com limites, aprovações e auditoria.' },
  { title: 'Seu restaurante, seu endereço', text: 'Cada estabelecimento tem um endereço de acesso, com dados isolados.' },
  { title: 'Sem retrabalho', text: 'Mesas, produtos e preços são cadastrados uma vez e usados por todos os aplicativos.' },
];

export const FLOW = [
  'Contrate o plano e crie seu endereço',
  'Cadastre equipe, mesas e cardápio',
  'Cada pessoa entra direto na sua área',
  'Acompanhe tudo na Gestão',
];
