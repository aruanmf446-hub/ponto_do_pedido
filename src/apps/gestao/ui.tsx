import type { ReactNode } from 'react';

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="gs-pagehead">
      <div>
        <h1 className="gs-h1">{title}</h1>
        {subtitle ? <p className="gs-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="gs-row">{actions}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="gs-stat">
      <span className="gs-stat-label">{label}</span>
      <span className="gs-stat-value">{value}</span>
      {hint ? <span className="gs-stat-hint">{hint}</span> : null}
    </div>
  );
}

export function Badge({ tone, children }: { tone?: 'ok' | 'warn' | 'danger' | 'accent'; children: ReactNode }) {
  return (
    <span className="gs-badge" data-tone={tone}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="gs-empty">{children}</p>;
}

export function Bars({ items, format }: { items: { label: string; value: number }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="gs-bars" role="list">
      {items.map((i) => (
        <div key={i.label} className="gs-bar" role="listitem">
          <span>{i.label}</span>
          <span className="gs-bar-track" aria-hidden="true">
            <span className="gs-bar-fill" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className="gs-num">{format(i.value)}</span>
        </div>
      ))}
    </div>
  );
}

export const MODULE_LABEL: Record<string, string> = {
  gestao: 'Gestão',
  caixa: 'Caixa',
  atendimento: 'Atendimento',
  cozinha: 'Cozinha',
  cardapio: 'Cardápio',
  delivery: 'Delivery',
  financeiro: 'Financeiro',
  estoque: 'Estoque',
};
