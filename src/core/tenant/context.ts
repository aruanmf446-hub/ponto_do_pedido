import 'server-only';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { APP_PATHS, INTERNAL_APPS, type AppModule, type InternalApp } from '@/core/apps';
import { createServerSupabase } from '@/core/supabase/server';

export type Decision = 'direct' | 'approval';

export type TenantContext = {
  state: 'ok';
  tenant: {
    id: string;
    slug: string;
    name: string;
    logo_path: string | null;
    timezone: string;
    business_day_start_hour: number;
    plan_code: string | null;
    license_valid_until: string | null;
    settings: Record<string, unknown>;
    onboarding_completed_at: string | null;
  };
  membership: {
    id: string;
    user_id: string;
    display_name: string;
    job_title: string | null;
    is_owner: boolean;
    primary_app: AppModule | null;
    must_change_password: boolean;
  };
  modules: AppModule[];
  permissions: Record<string, Decision>;
  process_ownership: Record<string, 'interno' | 'externo'>;
};

export type ContextResult =
  | TenantContext
  | { state: 'anonymous' }
  | { state: 'tenant_not_found' }
  | { state: 'no_membership' | 'membership_suspended'; tenant: { name: string; slug: string; logo_path: string | null } }
  | { state: 'tenant_inactive'; is_owner: boolean; tenant: { name: string; slug: string; status: string; logo_path: string | null } };

/** Base de links do restaurante: '' no subdomínio, '/r/<slug>' por caminho. */
export async function tenantBase(): Promise<string> {
  return (await headers()).get('x-pdp-base') ?? '';
}

/** URL absoluta dentro do restaurante atual (links públicos, QR Codes). */
export async function absoluteTenantUrl(path: string): Promise<string> {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? (h.get('host')?.includes('localhost') || h.get('host')?.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${h.get('host')}${h.get('x-pdp-base') ?? ''}${path}`;
}

export const loadContext = cache(async (slug: string): Promise<ContextResult> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('my_context', { p_slug: slug });
  if (error) throw new Error(error.message);
  return data as ContextResult;
});

export function can(ctx: TenantContext, permission: string): boolean {
  return ctx.permissions[permission] === 'direct';
}

export function canRequest(ctx: TenantContext, permission: string): boolean {
  return ctx.permissions[permission] === 'approval';
}

export function hasModule(ctx: TenantContext, module: AppModule): boolean {
  return module === 'gestao' || ctx.modules.includes(module);
}

export function canAccessApp(ctx: TenantContext, app: InternalApp): boolean {
  return hasModule(ctx, app) && can(ctx, `${app}.acessar`);
}

/** Área principal autorizada (sem tela de seleção de aplicativos). */
export function landingApp(ctx: TenantContext): InternalApp | null {
  const primary = ctx.membership.primary_app;
  if (primary && (INTERNAL_APPS as readonly string[]).includes(primary) && canAccessApp(ctx, primary as InternalApp)) {
    return primary as InternalApp;
  }
  return INTERNAL_APPS.find((app) => canAccessApp(ctx, app)) ?? null;
}

export function accessibleApps(ctx: TenantContext): InternalApp[] {
  return INTERNAL_APPS.filter((app) => canAccessApp(ctx, app));
}

/**
 * Garante acesso ao aplicativo interno. Trata: sessão expirada, restaurante
 * inexistente, usuário sem vínculo, assinatura suspensa, módulo não contratado
 * e falta de permissão.
 */
export async function requireApp(slug: string, app: InternalApp, nextPath?: string): Promise<TenantContext> {
  const base = await tenantBase();
  const ctx = await loadContext(slug);
  switch (ctx.state) {
    case 'anonymous':
      redirect(`${base}/?next=${encodeURIComponent(nextPath ?? APP_PATHS[app])}`);
    case 'tenant_not_found':
      notFound();
    case 'no_membership':
      redirect(`${base}/acesso?motivo=sem-vinculo`);
    case 'membership_suspended':
      redirect(`${base}/acesso?motivo=suspenso`);
    case 'tenant_inactive':
      redirect(`${base}/acesso?motivo=assinatura`);
    case 'ok':
      break;
  }
  if (ctx.membership.must_change_password) redirect(`${base}/senha`);
  if (!hasModule(ctx, app)) redirect(`${base}/acesso?motivo=modulo&app=${app}`);
  if (!canAccessApp(ctx, app)) redirect(`${base}/acesso?motivo=sem-permissao&app=${app}`);
  return ctx;
}

/** Áreas autorizadas fora dos aplicativos internos (ex.: Central de Delivery). */
export function extraAreas(ctx: TenantContext): { href: string; label: string }[] {
  const areas: { href: string; label: string }[] = [];
  if (hasModule(ctx, 'delivery') && (can(ctx, 'delivery.pedido.aceitar') || can(ctx, 'delivery.pedido.despachar'))) {
    areas.push({ href: '/delivery/central', label: 'Central de Delivery' });
  }
  return areas;
}

export async function requireTenantSlug(): Promise<string> {
  const slug = (await headers()).get('x-pdp-tenant');
  if (!slug) notFound();
  return slug;
}
