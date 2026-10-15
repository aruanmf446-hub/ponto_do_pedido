'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { decideApproval, executeApproval } from '@/core/actions';
import { formatTime, minutesSince } from '@/core/dates';
import { formatCents } from '@/core/money';
import { useTenant } from '@/core/ui/TenantProvider';
import { newIdempotencyKey, useAction } from '@/core/ui/useAction';
import { openTab } from '@/apps/atendimento/actions';
import type { OpenTab } from '@/apps/atendimento/queries';

export function TabsList({ tabs, tableLabels }: { tabs: OpenTab[]; tableLabels: Record<string, string> }) {
  const { base, timezone } = useTenant();
  return (
    <section className="at-panel">
      <h1 className="at-h1">Comandas abertas</h1>
      {tabs.length === 0 ? <p className="at-meta">Nenhuma comanda aberta.</p> : null}
      <ul className="at-list at-list--cards">
        {tabs.map((t) => (
          <li key={t.id}>
            <Link href={`${base}/atendimento/comanda/${t.id}`} className="at-tabcard">
              <strong>#{t.number}</strong>
              <span>{t.table_id ? `Mesa ${tableLabels[t.table_id] ?? ''}` : `Balcão${t.customer_name ? ` · ${t.customer_name}` : ''}`}</span>
              <span className="at-meta">
                {formatTime(t.opened_at, timezone)} · {minutesSince(t.opened_at)} min
              </span>
              <span>{formatCents(t.total_cents - t.paid_cents)} a receber</span>
              {t.bill_requested_at ? <span className="at-badge">Conta solicitada</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CounterOpen() {
  const { tenantId, base } = useTenant();
  const router = useRouter();
  const action = useAction();
  const [name, setName] = useState('');
  return (
    <section className="at-panel" style={{ maxWidth: 520 }}>
      <h1 className="at-h1">Atendimento no balcão</h1>
      <p className="at-meta">Abre uma comanda sem mesa (retirada no balcão).</p>
      <form
        className="at-form"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(() => openTab(tenantId, null, name, null, newIdempotencyKey('tab')), {
            refresh: false,
            onSuccess: (t) => router.push(`${base}/atendimento/comanda/${t.id}`),
          });
        }}
      >
        <label className="at-field">
          Nome do cliente
          <input className="at-input" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        {action.error ? <p className="at-error">{action.error.message}</p> : null}
        <button type="submit" className="at-btn at-btn--primary" disabled={action.pending || name.trim().length < 2}>
          Abrir comanda
        </button>
      </form>
    </section>
  );
}

type Approval = {
  id: string;
  summary: string;
  amount_cents: number | null;
  status: string;
  requested_by_name: string | null;
  reason: string | null;
  can_decide: boolean;
  can_execute: boolean;
  is_mine: boolean;
};

/** Aprovações no próprio aplicativo onde a operação ocorre. */
export function AtApprovals({ items }: { items: Approval[] }) {
  const { tenantId } = useTenant();
  const action = useAction();
  return (
    <section className="at-panel">
      <h1 className="at-h1">Aprovações do atendimento</h1>
      {action.error ? <p className="at-error">{action.error.message}</p> : null}
      {items.length === 0 ? <p className="at-meta">Nenhuma solicitação recente.</p> : null}
      <ul className="at-list">
        {items.map((a) => (
          <li key={a.id}>
            <span>
              <strong>{a.summary}</strong>
              {a.amount_cents != null ? ` · ${formatCents(a.amount_cents)}` : ''}
              <br />
              <small className="at-meta">
                {a.requested_by_name} · {a.reason ?? ''} · {a.status}
              </small>
            </span>
            <span className="at-row">
              {a.can_decide ? (
                <>
                  <button type="button" className="at-btn at-btn--small at-btn--primary" onClick={() => void action.run(() => decideApproval(tenantId, a.id, true, ''))}>
                    Aprovar
                  </button>
                  <button type="button" className="at-btn at-btn--small" onClick={() => void action.run(() => decideApproval(tenantId, a.id, false, ''))}>
                    Recusar
                  </button>
                </>
              ) : null}
              {a.can_execute ? (
                <button type="button" className="at-btn at-btn--small at-btn--primary" onClick={() => void action.run(() => executeApproval(tenantId, a.id))}>
                  Executar
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
