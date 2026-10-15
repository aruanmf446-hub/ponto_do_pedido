'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/core/ui/Icon';

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: '/atendimento', label: 'Mesas', icon: 'armchair' },
  { href: '/atendimento/comandas', label: 'Comandas', icon: 'receipt' },
  { href: '/atendimento/balcao', label: 'Balcão', icon: 'bag' },
  { href: '/atendimento/aprovacoes', label: 'Aprovações', icon: 'approvals' },
];

export function AtendimentoNav({ base }: { base: string }) {
  const pathname = usePathname();
  return (
    <nav className="at-nav" aria-label="Atendimento">
      {ITEMS.map((i) => {
        const full = `${base}${i.href}`;
        const active = i.href === '/atendimento' ? pathname === full : pathname.startsWith(full);
        const inTab = i.href === '/atendimento/comandas' && pathname.startsWith(`${base}/atendimento/comanda/`);
        return (
          <Link key={i.href} href={full} aria-current={active || inTab ? 'page' : undefined} title={i.label}>
            <Icon name={i.icon} size={18} />
            <span>{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
