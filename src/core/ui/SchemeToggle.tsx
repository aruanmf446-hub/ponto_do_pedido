'use client';

import { useSyncExternalStore } from 'react';

// Claro/escuro para o site institucional e os canais públicos (Cardápio e
// Delivery), que não usam os quatro modelos selecionáveis. Preferência local.
const KEY = 'pdp-scheme';
type Scheme = 'light' | 'dark';

function read(): Scheme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function SchemeToggle({ className }: { className?: string }) {
  const scheme = useSyncExternalStore(subscribe, read, () => 'light' as Scheme);
  const toggle = () => {
    const next: Scheme = scheme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    document.documentElement.dataset.scheme = next;
    listeners.forEach((l) => l());
  };
  return (
    <button
      type="button"
      className={['pdp-scheme-toggle', className].filter(Boolean).join(' ')}
      onClick={toggle}
      aria-label={scheme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
    >
      {scheme === 'dark' ? '☀' : '☾'}
    </button>
  );
}

/** Script inline que aplica o tema antes da hidratação (evita piscar). */
export const schemeScript = `try{var s=localStorage.getItem('${KEY}');if(s!=='light'&&s!=='dark'){s=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.scheme=s}catch(e){}`;
