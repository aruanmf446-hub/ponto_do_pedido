'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { formatTime } from '@/core/dates';
import { formatCents, parseCents, splitEvenly } from '@/core/money';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { Dialog } from '@/core/ui/Dialog';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { newIdempotencyKey, useAction } from '@/core/ui/useAction';
import { charge, refund, setDiscount } from '@/apps/caixa/actions';
import type { Payment } from '@/apps/caixa/queries';

type Tab = {
  id: string;
  number: number;
  status: string;
  channel: string;
  customer_name: string | null;
  subtotal_cents: number;
  service_fee_cents: number;
  service_fee_percent: number;
  delivery_fee_cents: number;
  discount_cents: number;
  total_cents: number;
  paid_cents: number;
  table: { label: string } | null;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'];

export function ChargeScreen({
  tab,
  items,
  payments,
  methods,
  hasSession,
}: {
  tab: Tab;
  items: { name: string; quantity: number; unit_price_cents: number }[];
  payments: Payment[];
  methods: { id: string; name: string; kind: string }[];
  hasSession: boolean;
}) {
  const { tenantId, base, model, timezone } = useTenant();
  const canReceive = usePermission('caixa.receber') === 'direct';
  const canDiscount = usePermission('caixa.desconto') !== 'deny';
  const canRefund = usePermission('caixa.estorno') !== 'deny';
  const action = useAction();
  const balance = tab.total_cents - tab.paid_cents;
  const [method, setMethod] = useState(methods[0]?.id ?? '');
  const [amount, setAmount] = useState((balance / 100).toFixed(2).replace('.', ','));
  const [tendered, setTendered] = useState('');
  const [field, setField] = useState<'amount' | 'tendered'>('amount');
  const [payer, setPayer] = useState('');
  const [people, setPeople] = useState(1);
  const [key, setKey] = useState(() => newIdempotencyKey('pay'));
  const [message, setMessage] = useState<{ text: string; receipt?: string } | null>(null);
  const [dialog, setDialog] = useState<'discount' | 'refund' | null>(null);
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [reason, setReason] = useState('');
  const [discount, setDiscountValue] = useState('');
  const router = useRouter();

  const isCash = methods.find((m) => m.id === method)?.kind === 'dinheiro';
  const amountCents = parseCents(amount) ?? 0;
  const tenderedCents = parseCents(tendered);
  const change = isCash && tenderedCents != null ? Math.max(0, tenderedCents - amountCents) : 0;
  const parts = useMemo(() => (people > 1 && balance > 0 ? splitEvenly(balance, people) : []), [people, balance]);
  const open = tab.status === 'open';
  const valid = open && hasSession && canReceive && !!method && amountCents > 0 && amountCents <= balance && (!isCash || tenderedCents == null || tenderedCents >= amountCents);

  const submit = () => {
    if (!valid || action.pending) return;
    void action.run(
      () => charge(tenantId, { tabId: tab.id, methodId: method, amountCents, tenderedCents: isCash ? (tenderedCents ?? amountCents) : null, payer, key }),
      {
        onSuccess: (r) => {
          setKey(newIdempotencyKey('pay'));
          setTendered('');
          setPayer('');
          const remaining = r.tab.balance_cents;
          setAmount((Math.max(0, remaining) / 100).toFixed(2).replace('.', ','));
          setMessage({
            text: `${formatCents(amountCents)} recebido${r.payment.change_cents ? ` · troco ${formatCents(r.payment.change_cents)}` : ''}.${r.closed ? ' Comanda quitada.' : remaining > 0 ? ` Restam ${formatCents(remaining)}.` : ''}`,
            receipt: r.payment.id,
          });
        },
      },
    );
  };

  // Atalhos (modelo Terminal): 1–9 escolhe a forma, Enter confirma, Esc volta
  useEffect(() => {
    if (model !== 'm2') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      if (!typing && /^[1-9]$/.test(e.key)) {
        const m = methods[Number(e.key) - 1];
        if (m) setMethod(m.id);
      } else if (e.key === 'Enter' && !e.shiftKey && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape' && !document.querySelector('dialog[open]')) {
        router.push(`${base}/caixa`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const press = (k: string) => {
    const set = field === 'amount' ? setAmount : setTendered;
    const value = field === 'amount' ? amount : tendered;
    if (k === '⌫') return set(value.slice(0, -1));
    if (k === ',' && value.includes(',')) return;
    set(value + k);
  };

  const origin = tab.channel === 'salao' ? `Mesa ${tab.table?.label ?? ''}` : tab.channel === 'delivery' ? 'Delivery' : 'Balcão';
  const title = `Comanda #${tab.number} · ${origin}${tab.customer_name ? ` · ${tab.customer_name}` : ''}`;

  const summary = (
    <section className="cx-card cx-summary" aria-labelledby="resumo">
      <h2 id="resumo" className="cx-h2">
        Resumo
      </h2>
      <ul className="cx-items">
        {items.map((i, idx) => (
          <li key={idx}>
            <span>
              {i.quantity}× {i.name}
            </span>
            <span>{formatCents(i.quantity * i.unit_price_cents)}</span>
          </li>
        ))}
      </ul>
      <dl className="cx-totals">
        <dt>Consumo</dt>
        <dd>{formatCents(tab.subtotal_cents)}</dd>
        {tab.service_fee_cents ? (
          <>
            <dt>Serviço ({Number(tab.service_fee_percent)}%)</dt>
            <dd>{formatCents(tab.service_fee_cents)}</dd>
          </>
        ) : null}
        {tab.delivery_fee_cents ? (
          <>
            <dt>Entrega</dt>
            <dd>{formatCents(tab.delivery_fee_cents)}</dd>
          </>
        ) : null}
        {tab.discount_cents ? (
          <>
            <dt>Desconto</dt>
            <dd>−{formatCents(tab.discount_cents)}</dd>
          </>
        ) : null}
        <dt className="cx-strong">Total</dt>
        <dd className="cx-strong">{formatCents(tab.total_cents)}</dd>
        <dt>Pago</dt>
        <dd>{formatCents(tab.paid_cents)}</dd>
      </dl>
      {canDiscount && open ? (
        <button type="button" className="cx-btn cx-btn--small" onClick={() => setDialog('discount')}>
          Aplicar desconto
        </button>
      ) : null}
    </section>
  );

  const paymentsList = (
    <section className="cx-card" aria-labelledby="pagamentos">
      <h2 id="pagamentos" className="cx-h2">
        Pagamentos
      </h2>
      {payments.length === 0 ? <p className="cx-muted">Nenhum pagamento ainda.</p> : null}
      <ul className="cx-items">
        {payments.map((p) => (
          <li key={p.id} data-status={p.status}>
            <span>
              {formatTime(p.received_at, timezone)} · {p.method?.name ?? p.method_kind}
              {p.payer_label ? ` · ${p.payer_label}` : ''} · nº {p.receipt_number}
              {p.status === 'refunded' ? ` · estornado (${p.refund_reason})` : ''}
            </span>
            <span className="cx-row">
              {formatCents(p.amount_cents)}
              <Link className="cx-link" href={`${base}/caixa/comprovante/${p.id}`}>
                Comprovante
              </Link>
              {p.status === 'confirmed' && canRefund ? (
                <button type="button" className="cx-link" onClick={() => (setRefundTarget(p), setReason(''), setDialog('refund'))}>
                  Estornar
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );

  const methodButtons = (
    <div className="cx-methods" role="radiogroup" aria-label="Forma de pagamento">
      {methods.map((m, i) => (
        <button key={m.id} type="button" role="radio" aria-checked={method === m.id} className="cx-method" data-kind={m.kind} onClick={() => setMethod(m.id)}>
          {model === 'm2' ? <kbd>{i + 1}</kbd> : null}
          {m.name}
        </button>
      ))}
    </div>
  );

  const amountInputs = (
    <div className="cx-amounts">
      <label className="cx-field">
        Valor a receber
        <input
          className="cx-input cx-input--big"
          inputMode="decimal"
          value={amount}
          onFocus={() => setField('amount')}
          onChange={(e) => setAmount(e.target.value)}
          aria-describedby="saldo"
        />
      </label>
      {isCash ? (
        <label className="cx-field">
          Valor entregue
          <input className="cx-input cx-input--big" inputMode="decimal" value={tendered} onFocus={() => setField('tendered')} onChange={(e) => setTendered(e.target.value)} />
          <span className="cx-change">Troco: {formatCents(change)}</span>
        </label>
      ) : null}
    </div>
  );

  const split = (
    <div className="cx-split">
      <label className="cx-field cx-field--inline">
        Dividir em
        <input className="cx-input" type="number" min={1} max={30} value={people} onChange={(e) => setPeople(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} />
      </label>
      {parts.map((p, i) => (
        <button key={i} type="button" className="cx-btn cx-btn--small" onClick={() => (setAmount((p / 100).toFixed(2).replace('.', ',')), setPayer(`Pessoa ${i + 1}`))}>
          {i + 1}: {formatCents(p)}
        </button>
      ))}
      <label className="cx-field cx-field--inline">
        Pagador
        <input className="cx-input" value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="Opcional" />
      </label>
    </div>
  );

  const confirm = (
    <button type="button" className="cx-btn cx-btn--primary cx-btn--confirm" disabled={!valid || action.pending} onClick={submit}>
      {action.pending ? 'Registrando…' : `Confirmar ${formatCents(amountCents)}`}
      {model === 'm2' ? <kbd>Enter</kbd> : null}
    </button>
  );

  const feedback = (
    <>
      {!hasSession ? (
        <p className="cx-error">
          Abra o caixa para receber. <Link href={`${base}/caixa`}>Abrir caixa</Link>
        </p>
      ) : null}
      {!open ? <p className="cx-ok">Comanda {tab.status === 'closed' ? 'quitada e encerrada' : 'cancelada'}.</p> : null}
      {action.error ? (
        <p className="cx-error" role="alert">
          {action.error.message}
        </p>
      ) : null}
      {message ? (
        <p className="cx-ok" role="status">
          {message.text}{' '}
          {message.receipt ? (
            <Link href={`${base}/caixa/comprovante/${message.receipt}`} className="cx-link">
              Ver comprovante
            </Link>
          ) : null}
        </p>
      ) : null}
    </>
  );

  const balanceBlock = (
    <div className="cx-balance" id="saldo">
      <span>Saldo a receber</span>
      <strong>{formatCents(balance)}</strong>
    </div>
  );

  let body;
  if (model === 'm3') {
    body = (
      <div className="cx-charge cx-charge--touch">
        <div className="cx-pay">
          {balanceBlock}
          {methodButtons}
          {amountInputs}
          <div className="cx-keypad" aria-label="Teclado numérico">
            {KEYS.map((k) => (
              <button key={k} type="button" onClick={() => press(k)} aria-label={k === '⌫' ? 'Apagar' : k}>
                {k}
              </button>
            ))}
          </div>
          {split}
          {confirm}
          {feedback}
        </div>
        <div className="cx-side-col">
          {summary}
          {paymentsList}
        </div>
      </div>
    );
  } else if (model === 'm2') {
    body = (
      <div className="cx-charge cx-charge--term">
        <div className="cx-side-col">
          {summary}
          {paymentsList}
        </div>
        <div className="cx-pay">
          {balanceBlock}
          {methodButtons}
          {amountInputs}
          {split}
          {confirm}
          {feedback}
          <p className="cx-muted">[1–9] forma · [Enter] confirmar · [Esc] voltar</p>
        </div>
      </div>
    );
  } else if (model === 'm4') {
    body = (
      <div className="cx-charge cx-charge--erp">
        <fieldset className="cx-fieldset">
          <legend>Itens e totais</legend>
          {summary}
        </fieldset>
        <fieldset className="cx-fieldset">
          <legend>Recebimento</legend>
          {balanceBlock}
          <label className="cx-field">
            Forma de pagamento
            <select className="cx-input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          {amountInputs}
          {split}
          {confirm}
          {feedback}
        </fieldset>
        <fieldset className="cx-fieldset cx-fieldset--wide">
          <legend>Lançamentos</legend>
          {paymentsList}
        </fieldset>
      </div>
    );
  } else {
    body = (
      <div className="cx-charge cx-charge--minimal">
        {balanceBlock}
        {methodButtons}
        {amountInputs}
        {split}
        {confirm}
        {feedback}
        <details className="cx-details">
          <summary>Detalhes da comanda</summary>
          {summary}
        </details>
        {paymentsList}
      </div>
    );
  }

  return (
    <div className="cx-section">
      <div className="cx-row cx-spread">
        <h1 className="cx-h1">{title}</h1>
        <Link href={`${base}/caixa`} className="cx-link">
          ← Voltar
        </Link>
      </div>
      {methods.length === 0 ? <p className="cx-error">Nenhuma forma de pagamento habilitada para o Caixa. Configure na Gestão.</p> : null}
      {body}

      <Dialog open={dialog === 'discount'} onClose={() => setDialog(null)} title="Desconto na comanda">
        <div className="cx-form">
          <label className="cx-field">
            Valor total do desconto (R$)
            <input className="cx-input" inputMode="decimal" value={discount} onChange={(e) => setDiscountValue(e.target.value)} />
          </label>
          <label className="cx-field">
            Motivo
            <input className="cx-input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button
            type="button"
            className="cx-btn cx-btn--primary"
            disabled={action.pending || parseCents(discount) == null || reason.trim().length < 3}
            onClick={() => {
              const cents = parseCents(discount) ?? 0;
              void action.run(() => setDiscount(tenantId, tab.id, cents, reason.trim()), {
                onSuccess: () => (setDialog(null), setAmount(((balance - (cents - tab.discount_cents)) / 100).toFixed(2).replace('.', ','))),
                approval: {
                  kind: 'tab.discount',
                  summary: `Desconto de ${formatCents(cents)} na comanda #${tab.number}`,
                  amountCents: cents,
                  payload: { tab_id: tab.id, discount_cents: cents, reason: reason.trim() },
                },
              });
            }}
          >
            Aplicar
          </button>
        </div>
      </Dialog>
      <Dialog open={dialog === 'refund' && !!refundTarget} onClose={() => setDialog(null)} title="Estornar pagamento">
        {refundTarget ? (
          <div className="cx-form">
            <p>
              Estornar {formatCents(refundTarget.amount_cents)} ({refundTarget.method?.name ?? refundTarget.method_kind}, recibo nº {refundTarget.receipt_number}). A comanda
              volta a ter saldo.
            </p>
            <label className="cx-field">
              Motivo
              <input className="cx-input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <button
              type="button"
              className="cx-btn cx-btn--primary"
              disabled={action.pending || reason.trim().length < 3}
              onClick={() =>
                void action.run(() => refund(tenantId, refundTarget.id, reason.trim()), {
                  onSuccess: () => setDialog(null),
                  approval: {
                    kind: 'payment.refund',
                    summary: `Estorno de ${formatCents(refundTarget.amount_cents)} (comanda #${tab.number})`,
                    amountCents: refundTarget.amount_cents,
                    payload: { payment_id: refundTarget.id, reason: reason.trim() },
                  },
                })
              }
            >
              Confirmar estorno
            </button>
          </div>
        ) : null}
      </Dialog>
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </div>
  );
}
