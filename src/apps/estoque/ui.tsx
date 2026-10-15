import type { ReactNode } from 'react';

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="es-pagehead">
      <div>
        <h1 className="es-h1">{title}</h1>
        {subtitle ? <p className="es-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="es-row">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, children, actions, className }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={['es-panel', className].filter(Boolean).join(' ')}>
      {title || actions ? (
        <header className="es-panel-head">
          {title ? <h2 className="es-h2">{title}</h2> : <span />}
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Badge({ tone, children }: { tone?: 'ok' | 'warn' | 'danger' | 'accent'; children: ReactNode }) {
  return (
    <span className="es-badge" data-tone={tone}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="es-empty">{children}</p>;
}

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function fmtQty(value: number | string, unit?: string): string {
  const n = Number(value);
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ''}`;
}

/** Dias até o vencimento (negativo = vencido). */
export function daysTo(iso: string, today: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function expiryTone(iso: string | null, today: string): 'ok' | 'warn' | 'danger' | undefined {
  if (!iso) return undefined;
  const d = daysTo(iso, today);
  return d < 0 ? 'danger' : d <= 7 ? 'warn' : 'ok';
}

export const MOVE_LABEL: Record<string, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  transferencia: 'Transferência',
  ajuste: 'Ajuste',
  perda: 'Perda',
  descarte: 'Descarte',
};

export const REQ_LABEL: Record<string, string> = {
  requested: 'Solicitada',
  authorized: 'Autorizada',
  fulfilled: 'Entregue',
  purchase_requested: 'Em compra',
  rejected: 'Recusada',
  cancelled: 'Cancelada',
};

export const LOCATION_KINDS: Record<string, string> = {
  deposito: 'Depósito',
  camara_fria: 'Câmara fria',
  freezer: 'Freezer',
  setor: 'Setor',
  prateleira: 'Prateleira',
  outro: 'Outro',
};
