'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { VisualModel } from '@/core/apps';
import { ESTOQUE_NAV } from '@/apps/estoque/models';

export function EstoqueNav({ base, model, badges }: { base: string; model: VisualModel; badges: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav className="es-nav" aria-label="Estoque">
      {ESTOQUE_NAV.map((i, n) => {
        const full = `${base}${i.href}`;
        const active = i.href === '/estoque' ? pathname === full : pathname.startsWith(full);
        const badge = badges[i.href] ?? 0;
        return (
          <Link key={i.href} href={full} aria-current={active ? 'page' : undefined} title={i.label}>
            <span className="es-nav-icon" aria-hidden="true">
              {model === 'm1' ? String(n + 1).padStart(2, '0') : i.icon}
            </span>
            <span className="es-nav-label">{i.label}</span>
            {badge > 0 ? <span className="es-nav-badge">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
