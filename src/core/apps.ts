// Catálogo dos aplicativos internos (contrato compartilhado). Cada aplicativo
// é um produto independente; aqui ficam apenas identificadores e rotas base.

export type AppModule = 'gestao' | 'caixa' | 'atendimento' | 'cozinha' | 'cardapio' | 'delivery' | 'financeiro' | 'estoque';

/** Aplicativos internos com login de colaborador (ordem de prioridade). */
export const INTERNAL_APPS = ['gestao', 'atendimento', 'caixa', 'cozinha', 'financeiro', 'estoque'] as const;
export type InternalApp = (typeof INTERNAL_APPS)[number];

export const APP_LABELS: Record<AppModule, string> = {
  gestao: 'Gestão',
  caixa: 'Caixa',
  atendimento: 'Atendimento',
  cozinha: 'Cozinha',
  cardapio: 'Cardápio Digital',
  delivery: 'Delivery',
  financeiro: 'Administrativo e Financeiro',
  estoque: 'Estoque',
};

export const APP_PATHS: Record<InternalApp, string> = {
  gestao: '/gestao',
  caixa: '/caixa',
  atendimento: '/atendimento',
  cozinha: '/cozinha',
  financeiro: '/financeiro',
  estoque: '/estoque',
};

export function isInternalApp(value: string | null | undefined): value is InternalApp {
  return !!value && (INTERNAL_APPS as readonly string[]).includes(value);
}

export const VISUAL_MODELS = ['m1', 'm2', 'm3', 'm4'] as const;
export type VisualModel = (typeof VISUAL_MODELS)[number];
export type ColorScheme = 'light' | 'dark' | 'system';

export function isVisualModel(value: unknown): value is VisualModel {
  return typeof value === 'string' && (VISUAL_MODELS as readonly string[]).includes(value);
}
