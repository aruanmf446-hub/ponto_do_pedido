'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/core/ui/Icon';
import type { GestaoNavItem } from '@/apps/gestao/models';

function useActive(base: string) {
  const pathname = usePathname();
  return (href: string) => {
    const full = `${base}${href}`;
    return href === '/gestao' ? pathname === full : pathname === full || pathname.startsWith(`${full}/`);
  };
}

export function GestaoNav({
  items,
  base,
  grouped,
  pendingApprovals,
}: {
  items: GestaoNavItem[];
  base: string;
  grouped: boolean;
  pendingApprovals: number;
}) {
  const isActive = useActive(base);
  const render = (item: GestaoNavItem) => (
    <li key={item.href}>
      <Link href={`${base}${item.href}`} aria-current={isActive(item.href) ? 'page' : undefined} className="gs-navlink" title={item.label}>
        <span className="gs-navicon">
          <Icon name={item.icon} size={18} />
        </span>
        <span className="gs-navlabel">{item.label}</span>
        {item.href === '/gestao/aprovacoes' && pendingApprovals > 0 ? (
          <span className="gs-navbadge" aria-label={`${pendingApprovals} pendentes`}>
            {pendingApprovals}
          </span>
        ) : null}
      </Link>
    </li>
  );

  if (!grouped) {
    return (
      <nav className="gs-nav" aria-label="Gestão">
        <ul>{items.map(render)}</ul>
      </nav>
    );
  }
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <nav className="gs-nav" aria-label="Gestão">
      {groups.map((g) => (
        <div key={g} className="gs-navgroup">
          <p className="gs-navgroup-title">{g}</p>
          <ul>{items.filter((i) => i.group === g).map(render)}</ul>
        </div>
      ))}
    </nav>
  );
}

/** Trilha de navegação (Gestão › página atual). */
export function GestaoCrumbs({ items, base }: { items: GestaoNavItem[]; base: string }) {
  const isActive = useActive(base);
  const current = items.find((i) => isActive(i.href));
  return (
    <nav className="gs-crumbs" aria-label="Trilha">
      <Link href={`${base}/gestao`}>Gestão</Link>
      {current && current.href !== '/gestao' ? (
        <>
          <Icon name="chevron" size={14} />
          <span aria-current="page">{current.label}</span>
        </>
      ) : (
        <>
          <Icon name="chevron" size={14} />
          <span aria-current="page">Painel</span>
        </>
      )}
    </nav>
  );
}
