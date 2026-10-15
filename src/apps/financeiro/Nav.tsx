'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { VisualModel } from '@/core/apps';
import { Icon } from '@/core/ui/Icon';
import { FINANCEIRO_NAV } from '@/apps/financeiro/models';

/** Navegação do Administrativo e Financeiro; a forma muda com o modelo. */
export function FinanceiroNav({ base, model, visible, badges }: { base: string; model: VisualModel; visible: string[]; badges: Record<string, number> }) {
  const pathname = usePathname();
  const items = FINANCEIRO_NAV.filter((i) => visible.includes(i.href));
  return (
    <nav className="fn-nav" aria-label="Administrativo e Financeiro">
      {model === 'm3' ? <p className="fn-nav-title">Pastas do escritório</p> : null}
      {model === 'm1' || model === 'm4' ? <p className="fn-nav-title">Menu</p> : null}
      {items.map((i) => {
        const full = `${base}${i.href}`;
        const active = i.href === '/financeiro' ? pathname === full : pathname.startsWith(full);
        const badge = badges[i.href] ?? 0;
        return (
          <Link key={i.href} href={full} aria-current={active ? 'page' : undefined} title={i.label}>
            <span className="fn-nav-icon">
              <Icon name={model === 'm3' && i.href !== '/financeiro' ? 'folder' : i.icon} size={17} />
            </span>
            <span className="fn-nav-label">{i.label}</span>
            {badge > 0 ? <span className="fn-nav-badge">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
