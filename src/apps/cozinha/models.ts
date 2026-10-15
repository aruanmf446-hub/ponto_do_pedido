import type { ModelOption } from '@/core/ui/ModelPicker';

export const COZINHA_MODELS: ModelOption[] = [
  { id: 'm1', name: 'Kanban de Pedidos', description: 'Colunas Recebidos, Em preparo, Prontos e Entregues em cartões claros.' },
  { id: 'm2', name: 'Fila de Produção', description: 'Comandas em trilho horizontal, tema escuro e alto contraste.' },
  { id: 'm3', name: 'Estações de Preparo', description: 'Colunas pelas etapas da cozinha (ex.: Montagem, Forno, Finalização).' },
  { id: 'm4', name: 'Comando Minimalista', description: 'Um pedido em foco com cronômetro e a próxima fila ao lado.' },
];
