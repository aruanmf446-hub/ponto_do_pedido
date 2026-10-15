import type { ReactNode } from 'react';
import { CozinhaShell } from '@/apps/cozinha/Shell';
import { getUiPreference } from '@/core/prefs';
import { accessibleApps, can, hasModule, requireApp, tenantBase } from '@/core/tenant/context';

export const dynamic = 'force-dynamic';

export default async function CozinhaLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'cozinha');
  const [pref, base] = await Promise.all([getUiPreference(ctx.tenant.id, 'cozinha'), tenantBase()]);
  return (
    <CozinhaShell
      ctx={ctx}
      pref={pref}
      base={base}
      apps={accessibleApps(ctx)}
      canRequestMaterials={hasModule(ctx, 'estoque') && can(ctx, 'estoque.solicitacao.criar') && ctx.process_ownership.estoque !== 'externo'}
    >
      {children}
    </CozinhaShell>
  );
}
