import type { CookieOptions } from '@supabase/ssr';
import { config } from '@/core/config';
import { normalizeHost } from '@/core/tenant/host';

/**
 * A sessão é compartilhada entre o domínio principal e os subdomínios dos
 * restaurantes (mesma identidade), definindo o cookie no domínio raiz.
 * Em localhost/prévias o cookie fica restrito ao host atual.
 */
export function cookieDomainFor(host: string | null | undefined): string | undefined {
  const h = normalizeHost(host);
  const root = normalizeHost(config.rootDomain);
  if (h === root || h.endsWith(`.${root}`)) return `.${root}`;
  return undefined;
}

export function withCookieDomain(options: CookieOptions, host: string | null | undefined): CookieOptions {
  const domain = cookieDomainFor(host);
  return domain ? { ...options, domain } : options;
}
