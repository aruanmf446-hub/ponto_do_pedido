'use client';

import { useEffect, useState } from 'react';
import { formatTime } from '@/core/dates';
import { formatCents } from '@/core/money';
import { trackDelivery, type Tracking } from '@/apps/delivery/actions';

const STEPS = [
  ['awaiting_acceptance', 'Pedido enviado'],
  ['accepted', 'Confirmado'],
  ['preparing', 'Em preparo'],
  ['ready', 'Pronto para entrega'],
  ['out_for_delivery', 'Saiu para entrega'],
  ['delivered', 'Entregue'],
] as const;

function stepIndex(t: NonNullable<Tracking>): number {
  if (t.status === 'delivered') return 5;
  if (t.status === 'out_for_delivery') return 4;
  if (t.status === 'accepted') return t.kitchen_status === 'ready' ? 3 : t.kitchen_status === 'preparing' ? 2 : 1;
  return 0;
}

export function TrackingView({ token, initial, timezone }: { token: string; initial: NonNullable<Tracking>; timezone: string }) {
  const [t, setT] = useState(initial);
  useEffect(() => {
    if (t.status === 'delivered' || t.status === 'rejected' || t.status === 'cancelled') return;
    const timer = setInterval(async () => {
      const r = await trackDelivery(token);
      if (r.ok && r.data) setT(r.data);
    }, 15_000);
    return () => clearInterval(timer);
  }, [token, t.status]);

  const idx = stepIndex(t);
  return (
    <div className="dl-track">
      <h1>Pedido nº {t.number}</h1>
      {t.status === 'rejected' ? (
        <p className="dl-error">O restaurante não pôde aceitar este pedido{t.rejected_reason ? `: ${t.rejected_reason}` : '.'}</p>
      ) : (
        <ol className="dl-progress">
          {STEPS.map(([key, label], i) => (
            <li key={key} data-done={i <= idx} aria-current={i === idx ? 'step' : undefined}>
              <span className="dl-dot" aria-hidden="true" />
              {label}
              {key === 'awaiting_acceptance' ? <small>{formatTime(t.created_at, timezone)}</small> : null}
              {key === 'accepted' && t.accepted_at ? <small>{formatTime(t.accepted_at, timezone)}</small> : null}
              {key === 'out_for_delivery' && t.dispatched_at ? <small>{formatTime(t.dispatched_at, timezone)}</small> : null}
              {key === 'delivered' && t.delivered_at ? <small>{formatTime(t.delivered_at, timezone)}</small> : null}
            </li>
          ))}
        </ol>
      )}
      <section className="dl-card">
        <h2>Resumo</h2>
        <ul className="dl-summary">
          {t.items.map((i, n) => (
            <li key={n} data-status={i.status}>
              <span>
                {i.quantity}× {i.name}
                {i.status !== 'active' ? ' (indisponível)' : ''}
              </span>
              <span>{formatCents(i.quantity * i.unit_price_cents)}</span>
            </li>
          ))}
        </ul>
        <dl className="dl-totals">
          <dt>Itens</dt>
          <dd>{formatCents(t.items_cents)}</dd>
          <dt>Entrega</dt>
          <dd>{formatCents(t.fee_cents)}</dd>
          <dt className="dl-strong">Total</dt>
          <dd className="dl-strong">{formatCents(t.items_cents + t.fee_cents)}</dd>
          {t.payment_method ? (
            <>
              <dt>Pagamento</dt>
              <dd>{t.payment_method}</dd>
            </>
          ) : null}
        </dl>
        {t.tenant.whatsapp ? (
          <a className="dl-btn dl-btn--ghost" href={`https://wa.me/55${t.tenant.whatsapp}`} target="_blank" rel="noreferrer">
            Falar com o restaurante
          </a>
        ) : null}
      </section>
    </div>
  );
}
