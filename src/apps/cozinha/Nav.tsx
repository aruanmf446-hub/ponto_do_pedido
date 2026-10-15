'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from '@/core/ui/Icon';

export function CozinhaNav({ base, canRequestMaterials }: { base: string; canRequestMaterials: boolean }) {
  const pathname = usePathname();
  const items: { href: string; label: string; icon: IconName }[] = [
    { href: '/cozinha', label: 'Pedidos', icon: 'chef' },
    ...(canRequestMaterials ? [{ href: '/cozinha/materiais', label: 'Solicitar material', icon: 'package' as IconName }] : []),
  ];
  return (
    <nav className="kz-nav" aria-label="Cozinha">
      {items.map((i) => {
        const full = `${base}${i.href}`;
        const active = i.href === '/cozinha' ? pathname === full : pathname.startsWith(full);
        return (
          <Link key={i.href} href={full} aria-current={active ? 'page' : undefined} title={i.label}>
            <Icon name={i.icon} size={18} />
            <span>{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Relógio da produção (fuso do restaurante). Renderizado só no navegador. */
export function KitchenClock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="kz-clock-big" aria-hidden="true" />;
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(now);
  const date = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, weekday: 'short', day: '2-digit', month: 'short' }).format(now);
  return (
    <span className="kz-clock-big">
      <small>{date}</small>
      <strong>{time}</strong>
    </span>
  );
}
