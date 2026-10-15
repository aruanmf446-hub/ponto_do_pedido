'use client';

import Link from 'next/link';
import { useState } from 'react';
import { minutesSince } from '@/core/dates';
import { formatCents, parseCents } from '@/core/money';
import { Icon, type IconName } from '@/core/ui/Icon';
import { LiveRefresh } from '@/core/ui/LiveRefresh';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { newIdempotencyKey, useAction } from '@/core/ui/useAction';
import { openCash } from '@/apps/caixa/actions';
import type { Expected, Receivable } from '@/apps/caixa/queries';

const CHANNEL_ICON: Record<string, IconName> = { salao: 'utensils', delivery: 'truck', balcao: 'bag' };
export const METHOD_ICON: Record<string, IconName> = { dinheiro: 'cash', pix: 'qr', credito: 'card', debito: 'card', vale: 'tag', outro: 'wallet' };

function origin(r: Receivable) {
  if (r.channel === 'salao') return `Mesa ${r.table?.label ?? ''}`;
  if (r.channel === 'delivery') return `Delivery${r.customer_name ? ` · ${r.customer_name}` : ''}`;
  return `Balcão${r.customer_name ? ` · ${r.customer_name}` : ''}`;
}

export function OpenCash() {
  const { tenantId } = useTenant();
  const canOpen = usePermission('caixa.abrir') === 'direct';
  const action = useAction();
  const [value, setValue] = useState('');
  const [key] = useState(() => newIdempotencyKey('cash'));
  return (
    <section className="cx-card cx-open" aria-labelledby="abrir">
      <span className="cx-open-icon" aria-hidden="true">
        <Icon name="lock" size={28} />
      </span>
      <h1 id="abrir" className="cx-h1">
        Abrir caixa
      </h1>
      <p className="cx-muted">Informe o fundo de troco disponível na gaveta.</p>
      {canOpen ? (
        <form
          className="cx-form"
          onSubmit={(e) => {
            e.preventDefault();
            const cents = parseCents(value);
            if (cents == null) return;
            void action.run(() => openCash(tenantId, cents, key));
          }}
        >
          <label className="cx-field">
            Valor inicial (R$)
            <input className="cx-input cx-input--big" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" autoFocus />
          </label>
          <div className="cx-quick" aria-label="Valores rápidos">
            {[100, 200, 300, 500].map((v) => (
              <button key={v} type="button" className="cx-chip" onClick={() => setValue(`${v},00`)}>
                {formatCents(v * 100)}
              </button>
            ))}
          </div>
          {action.error ? <p className="cx-error">{action.error.message}</p> : null}
          <button type="submit" className="cx-btn cx-btn--primary" disabled={action.pending || parseCents(value) == null}>
            Abrir caixa
          </button>
        </form>
      ) : (
        <p className="cx-error">Você não tem permissão para abrir o caixa.</p>
      )}
    </section>
  );
}

export function ReceivablesList({ items, expected }: { items: Receivable[]; expected: Expected | null }) {
  const { base, model, tenantId } = useTenant();
  const [query, setQuery] = useState('');
  const shown = items.filter((r) => !query || `${r.number} ${origin(r)} ${r.customer_name ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const forwarded = shown.filter((r) => r.forwarded_to_cashier_at || r.bill_requested_at);
  const others = shown.filter((r) => !r.forwarded_to_cashier_at && !r.bill_requested_at);
  const ordered = [...forwarded, ...others];
  const href = (r: Receivable) => `${base}/caixa/receber/${r.id}`;
  const balance = (r: Receivable) => r.total_cents - r.paid_cents;
  const flag = (r: Receivable) => (r.forwarded_to_cashier_at ? 'caixa' : r.bill_requested_at ? 'conta' : 'aberta');
  const flagLabel = (r: Receivable) => (r.forwarded_to_cashier_at ? 'Encaminhada' : r.bill_requested_at ? 'Conta solicitada' : 'Em consumo');

  const methods = expected?.methods ?? [];
  const received = methods.reduce((s, m) => s + m.received_cents - m.refunded_cents, 0);
  const pending = items.reduce((s, r) => s + balance(r), 0);
  const maxMethod = Math.max(1, ...methods.map((m) => m.received_cents));

  const kpis = (
    <div className="cx-kpis">
      <div className="cx-kpi" data-tone="ok">
        <Icon name="wallet" size={20} />
        <span>Recebido no turno</span>
        <strong>{formatCents(received)}</strong>
      </div>
      <div className="cx-kpi" data-tone="warn">
        <Icon name="receipt" size={20} />
        <span>A receber</span>
        <strong>{formatCents(pending)}</strong>
      </div>
      <div className="cx-kpi">
        <Icon name="clipboard" size={20} />
        <span>Comandas abertas</span>
        <strong>{items.length}</strong>
      </div>
      <div className="cx-kpi" data-tone="alert">
        <Icon name="bell" size={20} />
        <span>Pedindo a conta</span>
        <strong>{items.filter((r) => r.forwarded_to_cashier_at || r.bill_requested_at).length}</strong>
      </div>
    </div>
  );

  const byMethod = methods.length ? (
    <section className="cx-card cx-bymethod" aria-labelledby="por-forma">
      <h2 id="por-forma" className="cx-h2">
        Por forma de pagamento
      </h2>
      <ul>
        {methods.map((m) => (
          <li key={m.method_id}>
            <span className="cx-method-ico" data-kind={m.kind}>
              <Icon name={METHOD_ICON[m.kind] ?? 'wallet'} size={16} />
            </span>
            <span className="cx-bymethod-name">{m.name}</span>
            <span className="cx-bar" style={{ ['--w' as string]: m.received_cents / maxMethod }}>
              <span />
            </span>
            <strong>{formatCents(m.received_cents - m.refunded_cents)}</strong>
          </li>
        ))}
      </ul>
    </section>
  ) : null;

  const search = (
    <label className="cx-search">
      <Icon name="search" size={16} />
      <span className="sr-only">Buscar comanda</span>
      <input className="cx-input" placeholder="Buscar comanda, mesa ou cliente" value={query} onChange={(e) => setQuery(e.target.value)} />
    </label>
  );
  const empty = items.length === 0 ? <p className="cx-empty">Nenhuma comanda com saldo a receber.</p> : null;
  const live = <LiveRefresh tenantId={tenantId} tables={['tabs']} />;
  const where = (r: Receivable) => (
    <span className="cx-origin">
      <Icon name={CHANNEL_ICON[r.channel] ?? 'receipt'} size={15} />
      {origin(r)}
    </span>
  );

  if (model === 'm3') {
    return (
      <section className="cx-section">
        {live}
        <div className="cx-pagehead">
          <h1 className="cx-h1">A receber</h1>
          {search}
        </div>
        {kpis}
        <div className="cx-tiles">
          {ordered.map((r) => (
            <Link key={r.id} href={href(r)} className="cx-tile" data-flag={flag(r)}>
              <span className="cx-tile-top">
                <span className="cx-tile-num">#{r.number}</span>
                <span className="cx-pill" data-flag={flag(r)}>
                  {flagLabel(r)}
                </span>
              </span>
              {where(r)}
              <span className="cx-tile-meta">
                <Icon name="clock" size={13} /> {minutesSince(r.opened_at)} min
              </span>
              <strong>{formatCents(balance(r))}</strong>
              <span className="cx-tile-go">
                Receber <Icon name="arrow-right" size={16} />
              </span>
            </Link>
          ))}
        </div>
        {empty}
      </section>
    );
  }

  if (model === 'm2' || model === 'm4') {
    return (
      <section className="cx-section">
        {live}
        <div className="cx-pagehead">
          <h1 className="cx-h1">{model === 'm2' ? '> contas a receber' : 'Contas a receber'}</h1>
          {search}
        </div>
        {kpis}
        <div className={model === 'm4' ? 'cx-split-view' : undefined}>
          <div className="cx-table-wrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th>Comanda</th>
                  <th>Origem</th>
                  <th>Situação</th>
                  <th className="cx-num">Total</th>
                  <th className="cx-num">Pago</th>
                  <th className="cx-num">Saldo</th>
                  <th aria-label="Ação" />
                </tr>
              </thead>
              <tbody>
                {ordered.map((r, i) => (
                  <tr key={r.id} data-flag={flag(r)}>
                    <td>
                      {model === 'm2' ? <kbd>{i + 1 <= 9 ? i + 1 : ''}</kbd> : null} #{r.number}
                    </td>
                    <td>{where(r)}</td>
                    <td>
                      <span className="cx-pill" data-flag={flag(r)}>
                        {r.forwarded_to_cashier_at || r.bill_requested_at ? flagLabel(r) : `Aberta há ${minutesSince(r.opened_at)} min`}
                      </span>
                    </td>
                    <td className="cx-num">{formatCents(r.total_cents)}</td>
                    <td className="cx-num">{formatCents(r.paid_cents)}</td>
                    <td className="cx-num">
                      <strong>{formatCents(balance(r))}</strong>
                    </td>
                    <td>
                      <Link className="cx-btn cx-btn--small" href={href(r)}>
                        Receber
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {model === 'm4' ? byMethod : null}
        </div>
        {empty}
      </section>
    );
  }

  const row = (r: Receivable) => (
    <li key={r.id}>
      <Link href={href(r)} data-flag={flag(r)}>
        <span className="cx-row-badge">{r.table?.label ?? `#${r.number}`}</span>
        <span className="cx-row-text">
          <strong>
            Comanda #{r.number} <span className="cx-pill" data-flag={flag(r)}>{flagLabel(r)}</span>
          </strong>
          <small>
            {where(r)} · aberta há {minutesSince(r.opened_at)} min
          </small>
        </span>
        <span className="cx-amount">{formatCents(balance(r))}</span>
        <Icon name="chevron" size={18} className="cx-row-go" />
      </Link>
    </li>
  );

  return (
    <section className="cx-section cx-home-minimal">
      {live}
      <div className="cx-hero">
        <span className="cx-eyebrow">Recebido neste turno</span>
        <strong className="cx-hero-value">{formatCents(received)}</strong>
        <span className="cx-muted">
          {items.length} comanda{items.length === 1 ? '' : 's'} em aberto · {formatCents(pending)} a receber
        </span>
      </div>
      <div className="cx-pagehead">
        <h1 className="cx-h1">A receber</h1>
        {search}
      </div>
      {forwarded.length ? <h2 className="cx-h2">Pedindo a conta</h2> : null}
      <ul className="cx-rows">{forwarded.map(row)}</ul>
      {others.length ? <h2 className="cx-h2">Em consumo</h2> : null}
      <ul className="cx-rows">{others.map(row)}</ul>
      {empty}
      {byMethod}
    </section>
  );
}
