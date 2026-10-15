'use client';

import { useState } from 'react';
import { formatTime, minutesSince } from '@/core/dates';
import { formatCents, parseCents } from '@/core/money';
import { LiveRefresh } from '@/core/ui/LiveRefresh';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { newIdempotencyKey, useAction } from '@/core/ui/useAction';
import { completeDelivery, dispatchDelivery, receiveDeliveryPayment, reviewDelivery } from '@/apps/delivery/actions';

export type CentralOrder = {
  tab_id: string;
  status: 'awaiting_acceptance' | 'accepted' | 'out_for_delivery' | 'delivered';
  customer_name: string;
  whatsapp: string;
  address: { street: string; number: string; complement: string; neighborhood: string; reference: string };
  fee_cents: number;
  change_for_cents: number | null;
  payment_method_id: string | null;
  notes: string | null;
  created_at: string;
  zone: { name: string } | null;
  tab: {
    number: number;
    total_cents: number;
    paid_cents: number;
    status: string;
    orders: { id: string; status: string; items: { name: string; quantity: number; unit_price_cents: number; status: string; notes: string | null }[] }[];
  } | null;
};

const COLUMNS: [CentralOrder['status'], string][] = [
  ['awaiting_acceptance', 'Novos'],
  ['accepted', 'Em produção'],
  ['out_for_delivery', 'Em rota'],
  ['delivered', 'Entregues — a receber'],
];

export function DeliveryCentral({ orders, methods }: { orders: CentralOrder[]; methods: { id: string; name: string; kind: string }[] }) {
  const { tenantId, timezone } = useTenant();
  const canAccept = usePermission('delivery.pedido.aceitar') === 'direct';
  const canDispatch = usePermission('delivery.pedido.despachar') === 'direct';
  const action = useAction();
  const [reject, setReject] = useState<{ id: string; reason: string } | null>(null);

  const card = (o: CentralOrder) => {
    const kitchenReady = o.tab?.orders.every((x) => ['ready', 'delivered', 'cancelled', 'rejected'].includes(x.status)) ?? false;
    const balance = (o.tab?.total_cents ?? 0) - (o.tab?.paid_cents ?? 0);
    const items = o.tab?.orders.flatMap((x) => x.items) ?? [];
    return (
      <article key={o.tab_id} className="dl-order">
        <header className="dl-row">
          <strong>#{o.tab?.number}</strong>
          <span className="dl-muted">
            {formatTime(o.created_at, timezone)} · {minutesSince(o.created_at)} min
          </span>
        </header>
        <p className="dl-order-who">
          {o.customer_name} ·{' '}
          <a href={`https://wa.me/55${o.whatsapp}`} target="_blank" rel="noreferrer">
            {o.whatsapp}
          </a>
        </p>
        <p className="dl-muted">
          {o.address.street}, {o.address.number}
          {o.address.complement ? ` — ${o.address.complement}` : ''} · {o.address.neighborhood} ({o.zone?.name})
          {o.address.reference ? ` · Ref.: ${o.address.reference}` : ''}
        </p>
        <ul className="dl-summary">
          {items.map((i, n) => (
            <li key={n} data-status={i.status}>
              <span>
                {i.quantity}× {i.name}
                {i.notes ? ` — ${i.notes}` : ''}
              </span>
              <span>{formatCents(i.quantity * i.unit_price_cents)}</span>
            </li>
          ))}
        </ul>
        {o.notes ? <p className="dl-muted">Obs.: {o.notes}</p> : null}
        <p className="dl-row">
          <span>Total {formatCents(o.tab?.total_cents ?? 0)}</span>
          <span>{balance > 0 ? `A receber ${formatCents(balance)}` : 'Pago'}</span>
        </p>
        {o.change_for_cents ? <p className="dl-muted">Troco para {formatCents(o.change_for_cents)}</p> : null}
        <div className="dl-row dl-actions">
          {o.status === 'awaiting_acceptance' && canAccept ? (
            <>
              <button type="button" className="dl-btn" disabled={action.pending} onClick={() => void action.run(() => reviewDelivery(tenantId, o.tab_id, true, ''))}>
                Aceitar
              </button>
              <button type="button" className="dl-btn dl-btn--ghost" onClick={() => setReject({ id: o.tab_id, reason: '' })}>
                Recusar
              </button>
            </>
          ) : null}
          {o.status === 'accepted' && canDispatch ? (
            <button type="button" className="dl-btn" disabled={action.pending || !kitchenReady} onClick={() => void action.run(() => dispatchDelivery(tenantId, o.tab_id))}>
              {kitchenReady ? 'Saiu para entrega' : 'Aguardando a cozinha'}
            </button>
          ) : null}
          {o.status === 'out_for_delivery' && canDispatch ? (
            <button type="button" className="dl-btn" disabled={action.pending} onClick={() => void action.run(() => completeDelivery(tenantId, o.tab_id))}>
              Confirmar entrega
            </button>
          ) : null}
          {balance > 0 && canDispatch && (o.status === 'out_for_delivery' || o.status === 'delivered') ? (
            <PayButton tabId={o.tab_id} balance={balance} methods={methods} defaultMethod={o.payment_method_id} />
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <div className="dl-central">
      <LiveRefresh tenantId={tenantId} tables={['delivery_orders', 'orders', 'tabs']} />
      <h1>Central de Delivery</h1>
      {action.error ? <p className="dl-error">{action.error.message}</p> : null}
      <div className="dl-columns">
        {COLUMNS.map(([status, title]) => {
          const list = orders.filter((o) => o.status === status && (status !== 'delivered' || (o.tab?.total_cents ?? 0) > (o.tab?.paid_cents ?? 0)));
          return (
            <section key={status} className="dl-col" aria-label={title}>
              <h2>
                {title} <span>{list.length}</span>
              </h2>
              {list.map(card)}
            </section>
          );
        })}
      </div>
      {reject ? (
        <div className="dl-card dl-form" role="dialog" aria-label="Recusar pedido">
          <label className="dl-field">
            Motivo da recusa (o cliente verá)
            <input value={reject.reason} onChange={(e) => setReject({ ...reject, reason: e.target.value })} />
          </label>
          <div className="dl-row">
            <button type="button" className="dl-btn dl-btn--ghost" onClick={() => setReject(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="dl-btn"
              disabled={reject.reason.trim().length < 3}
              onClick={() => void action.run(() => reviewDelivery(tenantId, reject.id, false, reject.reason.trim()), { onSuccess: () => setReject(null) })}
            >
              Recusar pedido
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PayButton({ tabId, balance, methods, defaultMethod }: { tabId: string; balance: number; methods: { id: string; name: string; kind: string }[]; defaultMethod: string | null }) {
  const { tenantId } = useTenant();
  const action = useAction();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState(defaultMethod ?? methods[0]?.id ?? '');
  const [tendered, setTendered] = useState('');
  const [key] = useState(() => newIdempotencyKey('dlpay'));
  const isCash = methods.find((m) => m.id === method)?.kind === 'dinheiro';
  if (!open) {
    return (
      <button type="button" className="dl-btn dl-btn--ghost" onClick={() => setOpen(true)}>
        Registrar pagamento
      </button>
    );
  }
  return (
    <div className="dl-form dl-pay">
      <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Forma">
        {methods.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {isCash ? <input inputMode="decimal" placeholder="Valor entregue" value={tendered} onChange={(e) => setTendered(e.target.value)} aria-label="Valor entregue" /> : null}
      <button
        type="button"
        className="dl-btn"
        disabled={action.pending || !method}
        onClick={() => void action.run(() => receiveDeliveryPayment(tenantId, tabId, method, balance, isCash ? (parseCents(tendered) ?? balance) : null, key))}
      >
        Receber {formatCents(balance)}
      </button>
      {action.error ? <p className="dl-error">{action.error.message}</p> : null}
    </div>
  );
}
