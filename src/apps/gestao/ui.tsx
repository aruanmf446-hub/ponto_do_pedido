import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/core/ui/Icon';

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

export function Stat({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: IconName;
  tone?: 'accent' | 'ok' | 'warn' | 'danger' | 'info' | 'violet';
}) {
  return (
    <div className="gs-stat" data-tone={tone}>
      {icon ? (
        <span className="gs-stat-icon">
          <Icon name={icon} size={20} />
        </span>
      ) : null}
      <span className="gs-stat-body">
        <span className="gs-stat-label">{label}</span>
        <span className="gs-stat-value">{value}</span>
        {hint ? <span className="gs-stat-hint">{hint}</span> : null}
      </span>
    </div>
  );
}

const DONUT_COLORS = ['var(--gs-c1)', 'var(--gs-c2)', 'var(--gs-c3)', 'var(--gs-c4)', 'var(--gs-c5)', 'var(--gs-c6)'];

/** Rosca com legenda (distribuição). */
export function Donut({
  items,
  center,
  caption,
}: {
  items: { label: string; value: number }[];
  center: ReactNode;
  caption?: string;
}) {
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  const lengths = items.map((i) => (i.value / total) * c);
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div className="gs-donut">
      <div className="gs-donut-chart">
        <svg viewBox="0 0 110 110" role="img" aria-label={caption ?? 'Distribuição'}>
          <circle cx="55" cy="55" r={r} fill="none" stroke="var(--gs-surface-2)" strokeWidth="14" />
          {items.map((item, i) => (
            <circle
              key={item.label}
              cx="55"
              cy="55"
              r={r}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth="14"
              strokeDasharray={`${Math.max(0, (lengths[i] ?? 0) - 2)} ${c}`}
              strokeDashoffset={-(offsets[i] ?? 0)}
              transform="rotate(-90 55 55)"
            />
          ))}
        </svg>
        <span className="gs-donut-center">{center}</span>
      </div>
      <ul className="gs-legend">
        {items.map((item, i) => (
          <li key={item.label}>
            <span className="gs-legend-dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Colunas verticais (série por dia). */
export function Columns({ items, format }: { items: { label: string; value: number }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="gs-columns" role="list">
      {items.map((i) => (
        <div key={i.label} className="gs-column" role="listitem" title={`${i.label}: ${format(i.value)}`}>
          <span className="gs-column-track">
            <span className="gs-column-fill" style={{ height: `${Math.max(i.value ? 4 : 0, (i.value / max) * 100)}%` }} />
          </span>
          <span className="gs-column-label">{i.label}</span>
        </div>
      ))}
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
