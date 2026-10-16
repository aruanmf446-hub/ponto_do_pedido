import { config } from '@/core/config';

/**
 * Subdomínio somente com infraestrutura confirmada; até lá, caminho /r/<slug>.
 * PDP_PATH_TENANTS controla a aceitação do fallback, independentemente da preferência.
 */
export function hasTenantSubdomains(): boolean {
  return config.tenantSubdomainsReady && !config.rootDomain.endsWith('.vercel.app');
}

export function tenantUrl(slug: string, path = ''): string {
  if (!hasTenantSubdomains()) return `/r/${slug}${path}`;
  return `https://${slug}.${config.rootDomain}${path}`;
}

export function tenantDisplayUrl(slug: string): string {
  if (!hasTenantSubdomains()) return `${config.rootDomain}/r/${slug}`;
  return `${slug}.${config.rootDomain}`;
}
