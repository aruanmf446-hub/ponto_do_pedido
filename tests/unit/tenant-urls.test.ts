import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('endereços do restaurante', () => {
  it('não anuncia subdomínio sem confirmação de infraestrutura mesmo com domínio próprio', async () => {
    vi.stubEnv('NEXT_PUBLIC_PDP_ROOT_DOMAIN', 'pontodopedido.com');
    vi.stubEnv('NEXT_PUBLIC_PDP_TENANT_SUBDOMAINS_READY', '0');
    const { tenantUrl, tenantDisplayUrl } = await import('@/core/tenant/urls');
    expect(tenantUrl('famiglia-da-pizza')).toBe('/r/famiglia-da-pizza');
    expect(tenantDisplayUrl('famiglia-da-pizza')).toBe('pontodopedido.com/r/famiglia-da-pizza');
  });
  it('não inventa wildcard de vercel.app mesmo com flag incorreta', async () => {
    vi.stubEnv('NEXT_PUBLIC_PDP_ROOT_DOMAIN', 'pontodopedido.vercel.app');
    vi.stubEnv('NEXT_PUBLIC_PDP_TENANT_SUBDOMAINS_READY', '1');
    const { tenantUrl } = await import('@/core/tenant/urls');
    expect(tenantUrl('famiglia-da-pizza')).toBe('/r/famiglia-da-pizza');
  });
  it('prefere subdomínio verificado e mantém fallback habilitado independentemente', async () => {
    vi.stubEnv('NEXT_PUBLIC_PDP_ROOT_DOMAIN', 'pontodopedido.com');
    vi.stubEnv('NEXT_PUBLIC_PDP_TENANT_SUBDOMAINS_READY', '1');
    vi.stubEnv('NEXT_PUBLIC_PDP_PATH_TENANTS', '1');
    const { tenantUrl } = await import('@/core/tenant/urls');
    expect(tenantUrl('famiglia-da-pizza')).toBe('https://famiglia-da-pizza.pontodopedido.com');
  });
  it('gera links e rótulos por caminho quando não existe domínio curinga', async () => {
    vi.stubEnv('NEXT_PUBLIC_PDP_PATH_TENANTS', '1');
    vi.stubEnv('NEXT_PUBLIC_PDP_ROOT_DOMAIN', 'pontodopedido.vercel.app');
    const { tenantUrl, tenantDisplayUrl } = await import('@/core/tenant/urls');
    expect(tenantUrl('bistro', '/gestao')).toBe('/r/bistro/gestao');
    expect(tenantDisplayUrl('bistro')).toBe('pontodopedido.vercel.app/r/bistro');
  });

  it('preserva o roteamento por subdomínio no domínio próprio', async () => {
    vi.stubEnv('NEXT_PUBLIC_PDP_PATH_TENANTS', '0');
    vi.stubEnv('NEXT_PUBLIC_PDP_TENANT_SUBDOMAINS_READY', '1');
    vi.stubEnv('NEXT_PUBLIC_PDP_ROOT_DOMAIN', 'pontodopedido.com');
    const { tenantUrl, tenantDisplayUrl } = await import('@/core/tenant/urls');
    expect(tenantUrl('bistro', '/gestao')).toBe('https://bistro.pontodopedido.com/gestao');
    expect(tenantDisplayUrl('bistro')).toBe('bistro.pontodopedido.com');
  });
});
