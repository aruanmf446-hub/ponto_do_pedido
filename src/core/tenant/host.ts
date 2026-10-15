// Resolução do estabelecimento pelo hostname (função pura, testada).

export type HostTarget =
  | { kind: 'platform' }
  | { kind: 'tenant'; slug: string; mode: 'subdomain' }
  | { kind: 'tenant'; slug: string; mode: 'path' }
  | { kind: 'invalid' };

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(['www', 'app', 'api', 'portal', 'admin', 'mail', 'static', 'cdn', 'suporte', 'ajuda', 'status', 'blog', 'assets', 'auth', 'login']);

export function isValidSlug(slug: string): boolean {
  return SLUG.test(slug) && !RESERVED.has(slug);
}

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? '').toLowerCase().trim().replace(/:\d+$/, '').replace(/\.$/, '');
}

/**
 * Decide se a requisição é da plataforma (domínio principal) ou de um restaurante.
 * - `restaurante.pontodopedido.com` → restaurante pelo subdomínio
 * - `restaurante.localhost` → restaurante (desenvolvimento)
 * - `/r/<slug>/...` → restaurante pelo caminho, somente quando permitido
 */
export function resolveHost(rawHost: string | null | undefined, pathname: string, rootDomain: string, allowPath: boolean): HostTarget {
  const host = normalizeHost(rawHost);
  const root = normalizeHost(rootDomain);

  const pathMatch = /^\/r\/([^/]+)(?:\/|$)/.exec(pathname);

  let sub: string | null = null;
  if (host.endsWith(`.${root}`)) sub = host.slice(0, -(root.length + 1));
  else if (host.endsWith('.localhost')) sub = host.slice(0, -'.localhost'.length);

  if (sub && sub !== 'www') {
    if (sub.includes('.') || !isValidSlug(sub)) return { kind: 'invalid' };
    return { kind: 'tenant', slug: sub, mode: 'subdomain' };
  }

  if (pathMatch) {
    const slug = decodeURIComponent(pathMatch[1] ?? '');
    if (!allowPath || !isValidSlug(slug)) return { kind: 'invalid' };
    return { kind: 'tenant', slug, mode: 'path' };
  }
  return { kind: 'platform' };
}

/** URL pública do restaurante (subdomínio) a partir do slug. */
export function tenantOrigin(slug: string, rootDomain: string, protocol = 'https:'): string {
  return `${protocol}//${slug}.${rootDomain}`;
}
