// Configuração pública da plataforma (valores definidos em next.config.ts a
// partir das variáveis PDP_*). Nada aqui é secreto.

export const config = {
  rootDomain: process.env.NEXT_PUBLIC_PDP_ROOT_DOMAIN ?? 'pontodopedido.com',
  pathTenants: process.env.NEXT_PUBLIC_PDP_PATH_TENANTS === '1',
  app: {
    url: process.env.NEXT_PUBLIC_PDP_APP_SUPABASE_URL ?? '',
    publishableKey: process.env.NEXT_PUBLIC_PDP_APP_SUPABASE_PUBLISHABLE_KEY ?? '',
  },
  billing: {
    url: process.env.NEXT_PUBLIC_PDP_BILLING_SUPABASE_URL ?? '',
    publishableKey: process.env.NEXT_PUBLIC_PDP_BILLING_SUPABASE_PUBLISHABLE_KEY ?? '',
  },
} as const;

export function assertConfigured(): void {
  if (!config.app.url || !config.app.publishableKey) {
    throw new Error('Supabase do aplicativo não configurado (PDP_APP_SUPABASE_URL / PDP_APP_SUPABASE_PUBLISHABLE_KEY).');
  }
}

export const DEVELOPER = 'crmplus.store';
export const PLATFORM_NAME = 'Ponto do Pedido';
