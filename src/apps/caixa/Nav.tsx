'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { VisualModel } from '@/core/apps';
import { Icon, type IconName } from '@/core/ui/Icon';

const ITEMS: { href: string; label: string; key: string; icon: IconName }[] = [
  { href: '/caixa', label: 'Receber', key: '1', icon: 'cash' },
  { href: '/caixa/movimentos', label: 'Movimentações', key: '2', icon: 'transfer' },
  { href: '/caixa/fechamento', label: 'Fechamento', key: '3', icon: 'lock' },
  { href: '/caixa/historico', label: 'Histórico', key: '4', icon: 'history' },
];

export function CaixaNav({ base, model }: { base: string; model: VisualModel }) {
  const pathname = usePathname();
  const router = useRouter();

  // Terminal: Alt+1..4 navega entre as telas
  useEffect(() => {
    if (model !== 'm2') return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const item = ITEMS.find((i) => i.key === e.key);
      if (item) {
        e.preventDefault();
        router.push(`${base}${item.href}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [model, base, router]);

  return (
    <nav className="cx-nav" aria-label="Caixa">
      {ITEMS.map((i) => {
        const full = `${base}${i.href}`;
        const active = i.href === '/caixa' ? pathname === full || pathname.startsWith(`${full}/receber`) : pathname.startsWith(full);
        return (
          <Link key={i.href} href={full} aria-current={active ? 'page' : undefined}>
            {model === 'm2' ? <kbd>Alt+{i.key}</kbd> : null}
            {model === 'm3' || model === 'm4' ? (
              <span className="cx-navicon">
                <Icon name={i.icon} size={model === 'm3' ? 22 : 16} />
              </span>
            ) : null}
            <span>{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
