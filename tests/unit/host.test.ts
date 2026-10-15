import { describe, expect, it } from 'vitest';
import { isValidSlug, normalizeHost, resolveHost } from '@/core/tenant/host';

const ROOT = 'pontodopedido.com';

describe('resolveHost', () => {
  it('trata o domínio principal como plataforma', () => {
    expect(resolveHost('pontodopedido.com', '/', ROOT, false)).toEqual({ kind: 'platform' });
    expect(resolveHost('www.pontodopedido.com', '/portal', ROOT, false)).toEqual({ kind: 'platform' });
  });

  it('resolve o restaurante pelo subdomínio', () => {
    expect(resolveHost('famiglia.pontodopedido.com', '/gestao', ROOT, false)).toEqual({ kind: 'tenant', slug: 'famiglia', mode: 'subdomain' });
    expect(resolveHost('FAMIGLIA.PontoDoPedido.com:443', '/', ROOT, false)).toEqual({ kind: 'tenant', slug: 'famiglia', mode: 'subdomain' });
  });

  it('aceita subdomínios .localhost em desenvolvimento', () => {
    expect(resolveHost('bistro.localhost:3000', '/', 'localhost', false)).toEqual({ kind: 'tenant', slug: 'bistro', mode: 'subdomain' });
  });

  it('recusa subdomínios aninhados, inválidos ou reservados', () => {
    expect(resolveHost('a.b.pontodopedido.com', '/', ROOT, false)).toEqual({ kind: 'invalid' });
    expect(resolveHost('admin.pontodopedido.com', '/', ROOT, false)).toEqual({ kind: 'invalid' });
    expect(resolveHost('-x.pontodopedido.com', '/', ROOT, false)).toEqual({ kind: 'invalid' });
  });

  it('só aceita /r/<slug> quando o modo por caminho está habilitado', () => {
    expect(resolveHost('pontodopedido.com', '/r/famiglia/caixa', ROOT, false)).toEqual({ kind: 'invalid' });
    expect(resolveHost('pontodopedido.com', '/r/famiglia/caixa', ROOT, true)).toEqual({ kind: 'tenant', slug: 'famiglia', mode: 'path' });
    expect(resolveHost('pontodopedido.com', '/r/api', ROOT, true)).toEqual({ kind: 'invalid' });
  });

  it('não confunde domínios parecidos com o principal', () => {
    expect(resolveHost('famiglia.pontodopedido.com.evil.io', '/', ROOT, false)).toEqual({ kind: 'platform' });
  });
});

describe('isValidSlug / normalizeHost', () => {
  it('valida slugs', () => {
    expect(isValidSlug('famiglia')).toBe(true);
    expect(isValidSlug('pizza-du-chef')).toBe(true);
    expect(isValidSlug('a')).toBe(false);
    expect(isValidSlug('Pizza')).toBe(false);
    expect(isValidSlug('www')).toBe(false);
  });
  it('normaliza host', () => {
    expect(normalizeHost('Ex.COM:8080')).toBe('ex.com');
    expect(normalizeHost('ex.com.')).toBe('ex.com');
    expect(normalizeHost(null)).toBe('');
  });
});
