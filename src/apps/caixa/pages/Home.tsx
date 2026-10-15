'use client';

import Link from 'next/link';
import { useState } from 'react';
import { minutesSince } from '@/core/dates';
import { formatCents, parseCents } from '@/core/money';
import { LiveRefresh } from '@/core/ui/LiveRefresh';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { newIdempotencyKey, useAction } from '@/core/ui/useAction';
import { openCash } from '@/apps/caixa/actions';
import type { Receivable } from '@/apps/caixa/queries';

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

export function ReceivablesList({ items }: { items: Receivable[] }) {
  const { base, model, tenantId } = useTenant();
  const [query, setQuery] = useState('');
  const shown = items.filter((r) => !query || `${r.number} ${origin(r)}`.toLowerCase().includes(query.toLowerCase()));
  const forwarded = shown.filter((r) => r.forwarded_to_cashier_at || r.bill_requested_at);
  const others = shown.filter((r) => !r.forwarded_to_cashier_at && !r.bill_requested_at);
  const href = (r: Receivable) => `${base}/caixa/receber/${r.id}`;

  const search = (
    <label className="cx-search">
      <span className="sr-only">Buscar comanda</span>
      <input className="cx-input" placeholder="Buscar comanda, mesa ou cliente" value={query} onChange={(e) => setQuery(e.target.value)} />
    </label>
  );

  const live = <LiveRefresh tenantId={tenantId} tables={['tabs']} />;

  if (model === 'm3') {
    return (
      <section className="cx-section">
        {live}
        <h1 className="cx-h1">A receber</h1>
        {search}
        <div className="cx-tiles">
          {[...forwarded, ...others].map((r) => (
            <Link key={r.id} href={href(r)} className="cx-tile" data-flag={r.forwarded_to_cashier_at ? 'caixa' : r.bill_requested_at ? 'conta' : undefined}>
              <span className="cx-tile-num">#{r.number}</span>
              <span>{origin(r)}</span>
              <strong>{formatCents(r.total_cents - r.paid_cents)}</strong>
            </Link>
          ))}
        </div>
        {items.length === 0 ? <p className="cx-muted">Nenhuma comanda com saldo a receber.</p> : null}
      </section>
    );
  }

  if (model === 'm2' || model === 'm4') {
    return (
      <section className="cx-section">
        {live}
        <div className="cx-row cx-spread">
          <h1 className="cx-h1">{model === 'm2' ? '> contas a receber' : 'Contas a receber'}</h1>
          {search}
        </div>
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
              {[...forwarded, ...others].map((r, i) => (
                <tr key={r.id}>
                  <td>
                    {model === 'm2' ? <kbd>{i + 1 <= 9 ? i + 1 : ''}</kbd> : null} #{r.number}
                  </td>
                  <td>{origin(r)}</td>
                  <td>{r.forwarded_to_cashier_at ? 'Encaminhada' : r.bill_requested_at ? 'Conta solicitada' : `Aberta há ${minutesSince(r.opened_at)} min`}</td>
                  <td className="cx-num">{formatCents(r.total_cents)}</td>
                  <td className="cx-num">{formatCents(r.paid_cents)}</td>
                  <td className="cx-num">
                    <strong>{formatCents(r.total_cents - r.paid_cents)}</strong>
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
        {items.length === 0 ? <p className="cx-muted">Nenhuma comanda com saldo a receber.</p> : null}
      </section>
    );
  }

  return (
    <section className="cx-section">
      {live}
      <h1 className="cx-h1">A receber</h1>
      {search}
      {forwarded.length ? <h2 className="cx-h2">Encaminhadas ou com conta solicitada</h2> : null}
      <ul className="cx-rows">
        {forwarded.map((r) => (
          <li key={r.id}>
            <Link href={href(r)}>
              <span>
                <strong>#{r.number}</strong> {origin(r)}
              </span>
              <span className="cx-amount">{formatCents(r.total_cents - r.paid_cents)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {others.length ? <h2 className="cx-h2">Demais comandas abertas</h2> : null}
      <ul className="cx-rows">
        {others.map((r) => (
          <li key={r.id}>
            <Link href={href(r)}>
              <span>
                <strong>#{r.number}</strong> {origin(r)}
              </span>
              <span className="cx-amount">{formatCents(r.total_cents - r.paid_cents)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {items.length === 0 ? <p className="cx-muted">Nenhuma comanda com saldo a receber.</p> : null}
    </section>
  );
}
