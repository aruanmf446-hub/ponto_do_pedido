import { config } from '@/core/config';

/**
 * Endereço do restaurante: subdomínio em produção; por caminho (/r/<slug>)
 * quando o ambiente não possui subdomínio curinga (desenvolvimento/prévias).
 */
export function tenantUrl(slug: string, path = ''): string {
  if (config.pathTenants) return `/r/${slug}${path}`;
  return `https://${slug}.${config.rootDomain}${path}`;
}

export function tenantDisplayUrl(slug: string): string {
  if (config.pathTenants) return `${config.rootDomain}/r/${slug}`;
  return `${slug}.${config.rootDomain}`;
}
