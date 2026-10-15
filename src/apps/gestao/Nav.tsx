'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { GestaoNavItem } from '@/apps/gestao/models';

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
  const pathname = usePathname();
  const isActive = (href: string) => {
    const full = `${base}${href}`;
    return href === '/gestao' ? pathname === full : pathname === full || pathname.startsWith(`${full}/`);
  };
  const render = (item: GestaoNavItem) => (
    <li key={item.href}>
      <Link href={`${base}${item.href}`} aria-current={isActive(item.href) ? 'page' : undefined} className="gs-navlink">
        <span className="gs-navicon" aria-hidden="true">
          {item.icon}
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
