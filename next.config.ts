import type { NextConfig } from 'next';

// As variáveis do ambiente usam o prefixo PDP_. URLs e chaves publicáveis do
// Supabase são públicas por natureza (protegidas por RLS) e são expostas ao
// navegador aqui. Chaves secretas nunca são lidas pela aplicação Next.js.
const publicEnv = {
  NEXT_PUBLIC_PDP_ROOT_DOMAIN: process.env.NEXT_PUBLIC_PDP_ROOT_DOMAIN ?? process.env.PDP_ROOT_DOMAIN ?? 'pontodopedido.com',
  NEXT_PUBLIC_PDP_APP_SUPABASE_URL: process.env.NEXT_PUBLIC_PDP_APP_SUPABASE_URL ?? process.env.PDP_APP_SUPABASE_URL ?? '',
  NEXT_PUBLIC_PDP_APP_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_PDP_APP_SUPABASE_PUBLISHABLE_KEY ?? process.env.PDP_APP_SUPABASE_PUBLISHABLE_KEY ?? '',
  NEXT_PUBLIC_PDP_BILLING_SUPABASE_URL:
    process.env.NEXT_PUBLIC_PDP_BILLING_SUPABASE_URL ?? process.env.PDP_BILLING_SUPABASE_URL ?? '',
  NEXT_PUBLIC_PDP_BILLING_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_PDP_BILLING_SUPABASE_PUBLISHABLE_KEY ?? process.env.PDP_BILLING_SUPABASE_PUBLISHABLE_KEY ?? '',
  NEXT_PUBLIC_PDP_TENANT_SUBDOMAINS_READY:
    process.env.NEXT_PUBLIC_PDP_TENANT_SUBDOMAINS_READY ?? process.env.PDP_TENANT_SUBDOMAINS_READY ?? '0',
  NEXT_PUBLIC_PDP_PATH_TENANTS: process.env.NEXT_PUBLIC_PDP_PATH_TENANTS ?? process.env.PDP_PATH_TENANTS ?? '0',
  NEXT_PUBLIC_PDP_SITE_TEMPLATE: process.env.NEXT_PUBLIC_PDP_SITE_TEMPLATE ?? process.env.PDP_SITE_TEMPLATE ?? 'm1',
};

const nextConfig: NextConfig = {
  env: publicEnv,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
