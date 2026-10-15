'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatTime, minutesSince } from '@/core/dates';
import { formatCents, parseCents, splitEvenly } from '@/core/money';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { Dialog } from '@/core/ui/Dialog';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { newIdempotencyKey, useAction } from '@/core/ui/useAction';
import {
  cancelItem,
  cancelOrder,
  closeTab,
  deliverOrder,
  receivePayment,
  requestBill,
  resolveIssue,
  reviewCustomerOrder,
  sendOrder,
  transferTab,
} from '@/apps/atendimento/actions';
import { MenuPicker, type PickerVariant } from '@/apps/atendimento/MenuPicker';
import type { MenuProduct, TabDetail, TabOrder } from '@/apps/atendimento/queries';

type DraftItem = { key: string; product_id: string; name: string; price_cents: number; quantity: number; notes: string };

const ORDER_STATUS: Record<string, string> = {
  pending_confirmation: 'Aguardando confirmação',
  confirmed: 'Na fila da cozinha',
  preparing: 'Em preparo',
  ready: 'Pronto',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  rejected: 'Recusado',
};

export function TabWorkspace({
  tab,
  tableLabel,
  orders,
  payments,
  methods,
  categories,
  products,
  freeTables,
}: {
  tab: TabDetail;
  tableLabel: string | null;
  orders: TabOrder[];
  payments: { id: string; amount_cents: number; method_kind: string; payer_label: string | null; status: string; received_at: string }[];
  methods: { id: string; name: string; kind: string }[];
  categories: { id: string; name: string }[];
  products: MenuProduct[];
  freeTables: { id: string; label: string }[];
}) {
  const { tenantId, base, model, timezone } = useTenant();
  const canOrder = usePermission('atendimento.pedido.registrar') === 'direct';
  const canReceive = usePermission('atendimento.pagamento.receber') === 'direct';
  const canClose = usePermission('atendimento.comanda.encerrar') === 'direct';
  const canTransfer = usePermission('atendimento.mesa.transferir') !== 'deny';
  const canConfirmCustomer = usePermission('atendimento.pedido.confirmar_cliente') === 'direct';
  const canDeliver = usePermission('atendimento.entrega.confirmar') === 'direct';
  const action = useAction();
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [draftKey, setDraftKey] = useState(() => newIdempotencyKey('ord'));
  const [notes, setNotes] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'transfer' | 'pay' | 'cancel' | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ kind: 'order' | 'item'; id: string; label: string; value: number } | null>(null);
  const isOpen = tab.status === 'open';
  const balance = tab.total_cents - tab.paid_cents;
  const pendingOrders = orders.some((o) => ['pending_confirmation', 'confirmed', 'preparing', 'ready'].includes(o.status));
  const draftTotal = draft.reduce((s, d) => s + d.price_cents * d.quantity, 0);

  const add = (p: MenuProduct) => {
    setSent(null);
    setDraft((d) => {
      const found = d.find((x) => x.product_id === p.id && !x.notes);
      if (found) return d.map((x) => (x === found ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x));
      return [...d, { key: `${p.id}-${Date.now()}`, product_id: p.id, name: p.name, price_cents: p.price_cents, quantity: 1, notes: '' }];
    });
  };

  const send = () =>
    void action.run(
      () => sendOrder(tenantId, tab.id, draft.map((d) => ({ product_id: d.product_id, quantity: d.quantity, notes: d.notes })), notes, draftKey),
      {
        onSuccess: (r) => {
          setDraft([]);
          setNotes('');
          setDraftKey(newIdempotencyKey('ord'));
          setSent(`Pedido #${r.order.number} enviado para a cozinha.`);
        },
      },
    );

  const variant: PickerVariant = model === 'm1' ? 'grid' : model === 'm2' ? 'list' : model === 'm3' ? 'search' : 'strip';
  const title = tableLabel ? `Mesa ${tableLabel}` : tab.customer_name ? `Balcão · ${tab.customer_name}` : 'Balcão';

  const header = (
    <header className="at-tabhead">
      <div>
        <Link href={`${base}/atendimento`} className="at-back">
          ← Mesas
        </Link>
        <h1>
          {title} <span className="at-tabnum">Comanda #{tab.number}</span>
        </h1>
        <p className="at-meta">
          Aberta às {formatTime(tab.opened_at, timezone)} · {minutesSince(tab.opened_at)} min
          {tab.bill_requested_at ? ` · conta solicitada (${tab.bill_requested_by === 'cliente' ? 'cliente' : 'atendimento'})` : ''}
          {tab.forwarded_to_cashier_at ? ' · encaminhada ao Caixa' : ''}
        </p>
      </div>
      {isOpen ? (
        <div className="at-row">
          {canTransfer && tab.channel === 'salao' ? (
            <button type="button" className="at-btn" onClick={() => setDialog('transfer')}>
              Transferir mesa
            </button>
          ) : null}
        </div>
      ) : (
        <span className="at-badge">{tab.status === 'closed' ? 'Comanda encerrada' : 'Comanda cancelada'}</span>
      )}
    </header>
  );

  const draftPanel =
    isOpen && canOrder ? (
      <section className="at-panel at-draft" aria-labelledby="draft-title">
        <h2 id="draft-title">Novo pedido</h2>
        {draft.length === 0 ? <p className="at-meta">Toque nos produtos para adicionar.</p> : null}
        <ul className="at-draft-items">
          {draft.map((d) => (
            <li key={d.key}>
              <div className="at-row at-spread">
                <strong>{d.name}</strong>
                <span>{formatCents(d.price_cents * d.quantity)}</span>
              </div>
              <div className="at-row">
                <div className="at-qty" role="group" aria-label={`Quantidade de ${d.name}`}>
                  <button type="button" aria-label="Diminuir" onClick={() => setDraft(draft.map((x) => (x.key === d.key ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))}>
                    −
                  </button>
                  <span>{d.quantity}</span>
                  <button type="button" aria-label="Aumentar" onClick={() => setDraft(draft.map((x) => (x.key === d.key ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x)))}>
                    +
                  </button>
                </div>
                <input
                  className="at-input"
                  placeholder="Observação (ex.: sem cebola)"
                  value={d.notes}
                  maxLength={200}
                  onChange={(e) => setDraft(draft.map((x) => (x.key === d.key ? { ...x, notes: e.target.value } : x)))}
                />
                <button type="button" className="at-link" onClick={() => setDraft(draft.filter((x) => x.key !== d.key))}>
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
        {draft.length ? (
          <>
            <input className="at-input" placeholder="Observação geral do pedido" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} />
            <button type="button" className="at-btn at-btn--primary at-btn--block" disabled={action.pending} onClick={send}>
              {action.pending ? 'Enviando…' : `Enviar para a cozinha · ${formatCents(draftTotal)}`}
            </button>
          </>
        ) : null}
        {sent ? (
          <p className="at-ok" role="status">
            {sent}
          </p>
        ) : null}
      </section>
    ) : null;

  const ordersPanel = (
    <section className="at-panel" aria-labelledby="orders-title">
      <h2 id="orders-title">Pedidos da comanda</h2>
      {orders.length === 0 ? <p className="at-meta">Nenhum pedido ainda.</p> : null}
      <ol className="at-orders">
        {orders.map((o) => (
          <li key={o.id} data-status={o.status}>
            <div className="at-row at-spread">
              <strong>
                #{o.number} {o.source === 'cardapio' ? <small className="at-meta">(QR Code)</small> : null}
              </strong>
              <span className="at-status" data-status={o.status}>
                {ORDER_STATUS[o.status] ?? o.status}
              </span>
            </div>
            {o.has_issue ? (
              <p className="at-warn">
                Item indisponível na cozinha. Combine com o cliente, cancele o item ou registre um substituto.
                <button type="button" className="at-btn at-btn--small" onClick={() => void action.run(() => resolveIssue(tenantId, o.id))}>
                  Resolvido
                </button>
              </p>
            ) : null}
            <ul className="at-items">
              {o.items.map((i) => (
                <li key={i.id} data-status={i.status}>
                  <span>
                    {i.quantity}× {i.name}
                    {i.notes ? <small> — {i.notes}</small> : null}
                    {i.status !== 'active' ? <small className="at-meta"> ({i.status === 'cancelled' ? 'cancelado' : 'indisponível'})</small> : null}
                  </span>
                  <span className="at-row">
                    {formatCents(i.unit_price_cents * i.quantity)}
                    {isOpen && i.status === 'active' && !['delivered', 'cancelled', 'rejected'].includes(o.status) ? (
                      <button
                        type="button"
                        className="at-link"
                        onClick={() => {
                          setCancelTarget({ kind: 'item', id: i.id, label: `${i.quantity}× ${i.name}`, value: i.unit_price_cents * i.quantity });
                          setDialog('cancel');
                        }}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <div className="at-row">
              {o.status === 'pending_confirmation' && canConfirmCustomer ? (
                <>
                  <button type="button" className="at-btn at-btn--small at-btn--primary" onClick={() => void action.run(() => reviewCustomerOrder(tenantId, o.id, true, ''))}>
                    Confirmar e enviar
                  </button>
                  <button type="button" className="at-btn at-btn--small" onClick={() => void action.run(() => reviewCustomerOrder(tenantId, o.id, false, 'Recusado pelo atendimento'))}>
                    Recusar
                  </button>
                </>
              ) : null}
              {o.status === 'ready' && o.delivery_by === 'atendimento' && canDeliver ? (
                <button type="button" className="at-btn at-btn--small at-btn--primary" disabled={action.pending} onClick={() => void action.run(() => deliverOrder(tenantId, o.id))}>
                  Confirmar entrega
                </button>
              ) : null}
              {['pending_confirmation', 'confirmed', 'preparing'].includes(o.status) && isOpen ? (
                <button
                  type="button"
                  className="at-btn at-btn--small"
                  onClick={() => {
                    setCancelTarget({ kind: 'order', id: o.id, label: `pedido #${o.number}`, value: o.items.filter((i) => i.status === 'active').reduce((s, i) => s + i.unit_price_cents * i.quantity, 0) });
                    setDialog('cancel');
                  }}
                >
                  Cancelar pedido
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );

  const accountPanel = (
    <section className="at-panel at-account" aria-labelledby="acc-title">
      <h2 id="acc-title">Conta</h2>
      <dl className="at-totals">
        <dt>Consumo</dt>
        <dd>{formatCents(tab.subtotal_cents)}</dd>
        {tab.service_fee_cents ? (
          <>
            <dt>Serviço ({Number(tab.service_fee_percent)}%)</dt>
            <dd>{formatCents(tab.service_fee_cents)}</dd>
          </>
        ) : null}
        {tab.discount_cents ? (
          <>
            <dt>Desconto</dt>
            <dd>−{formatCents(tab.discount_cents)}</dd>
          </>
        ) : null}
        <dt className="at-total">Total</dt>
        <dd className="at-total">{formatCents(tab.total_cents)}</dd>
        <dt>Pago</dt>
        <dd>{formatCents(tab.paid_cents)}</dd>
        <dt className="at-balance">Saldo</dt>
        <dd className="at-balance">{formatCents(balance)}</dd>
      </dl>
      {payments.length ? (
        <ul className="at-payments">
          {payments.map((p) => (
            <li key={p.id} data-status={p.status}>
              {formatTime(p.received_at, timezone)} · {p.payer_label ?? p.method_kind} · {formatCents(p.amount_cents)}
              {p.status === 'refunded' ? ' (estornado)' : ''}
            </li>
          ))}
        </ul>
      ) : null}
      {isOpen ? (
        <div className="at-actions">
          {!tab.bill_requested_at ? (
            <button type="button" className="at-btn" disabled={action.pending || orders.length === 0} onClick={() => void action.run(() => requestBill(tenantId, tab.id, false))}>
              Solicitar fechamento
            </button>
          ) : null}
          {balance > 0 && canReceive ? (
            <button type="button" className="at-btn at-btn--primary" onClick={() => setDialog('pay')}>
              Receber pagamento
            </button>
          ) : null}
          {balance > 0 && !tab.forwarded_to_cashier_at ? (
            <button type="button" className="at-btn" disabled={action.pending} onClick={() => void action.run(() => requestBill(tenantId, tab.id, true))}>
              Encaminhar ao Caixa
            </button>
          ) : null}
          {canClose && balance <= 0 && !pendingOrders ? (
            <button type="button" className="at-btn" disabled={action.pending} onClick={() => void action.run(() => closeTab(tenantId, tab.id))}>
              Encerrar comanda
            </button>
          ) : null}
        </div>
      ) : null}
      {balance <= 0 && pendingOrders && isOpen && tab.total_cents > 0 ? (
        <p className="at-meta">Quitada. A mesa será liberada automaticamente quando os pedidos forem entregues.</p>
      ) : null}
    </section>
  );

  const picker = isOpen && canOrder ? <MenuPicker categories={categories} products={products} variant={variant} onPick={add} /> : null;
  const error = action.error ? (
    <p className="at-error" role="alert">
      {action.error.message}
    </p>
  ) : null;

  return (
    <div className="at-ws" data-variant={variant}>
      {header}
      {error}
      <div className="at-ws-grid">
        {model === 'm1' ? (
          <>
            <div className="at-ws-menu">{picker}</div>
            <div className="at-ws-side">
              {draftPanel}
              {ordersPanel}
              {accountPanel}
            </div>
          </>
        ) : model === 'm2' ? (
          <>
            <div className="at-ws-main">
              {ordersPanel}
              {accountPanel}
            </div>
            <div className="at-ws-side">
              {draftPanel}
              {picker}
            </div>
          </>
        ) : model === 'm3' ? (
          <>
            <div className="at-ws-main">
              {ordersPanel}
              {draftPanel}
              {picker}
            </div>
            <div className="at-ws-side">{accountPanel}</div>
          </>
        ) : (
          <>
            <div className="at-ws-top">{picker}</div>
            <div className="at-ws-main">
              {draftPanel}
              {ordersPanel}
            </div>
            <div className="at-ws-side">{accountPanel}</div>
          </>
        )}
      </div>

      {dialog === 'transfer' ? (
        <Dialog open onClose={() => setDialog(null)} title="Transferir para outra mesa">
          {freeTables.length === 0 ? <p>Nenhuma mesa livre no momento.</p> : null}
          <div className="at-grid at-grid--compact">
            {freeTables.map((t) => (
              <button
                key={t.id}
                type="button"
                className="at-table at-table--chip"
                data-state="livre"
                disabled={action.pending}
                onClick={() =>
                  void action.run(() => transferTab(tenantId, tab.id, t.id), {
                    onSuccess: () => setDialog(null),
                    approval: { kind: 'tab.transfer', summary: `Transferir comanda #${tab.number} para a mesa ${t.label}`, payload: { tab_id: tab.id, to_table_id: t.id } },
                  })
                }
              >
                <span className="at-table-label">{t.label}</span>
              </button>
            ))}
          </div>
        </Dialog>
      ) : null}
      {dialog === 'cancel' && cancelTarget ? (
        <CancelDialog
          target={cancelTarget}
          onClose={() => setDialog(null)}
          onConfirm={(reason) =>
            void action.run(() => (cancelTarget.kind === 'order' ? cancelOrder(tenantId, cancelTarget.id, reason) : cancelItem(tenantId, cancelTarget.id, reason)), {
              onSuccess: () => setDialog(null),
              approval: {
                kind: cancelTarget.kind === 'order' ? 'order.cancel' : 'order_item.cancel',
                summary: `Cancelar ${cancelTarget.label} (comanda #${tab.number})`,
                amountCents: cancelTarget.value,
                payload: cancelTarget.kind === 'order' ? { order_id: cancelTarget.id, reason, context: 'atendimento' } : { item_id: cancelTarget.id, reason },
              },
            })
          }
          pending={action.pending}
        />
      ) : null}
      {dialog === 'pay' ? <PayDialog tab={tab} methods={methods} onClose={() => setDialog(null)} /> : null}
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </div>
  );
}

function CancelDialog({
  target,
  onClose,
  onConfirm,
  pending,
}: {
  target: { label: string; value: number };
  onClose: () => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open onClose={onClose} title={`Cancelar ${target.label}`}>
      <div className="at-form">
        <p>Valor: {formatCents(target.value)}. Pedidos prontos ou entregues não podem ser cancelados.</p>
        <label className="at-field">
          Motivo
          <input className="at-input" value={reason} onChange={(e) => setReason(e.target.value)} required />
        </label>
        <button type="button" className="at-btn at-btn--danger" disabled={pending || reason.trim().length < 3} onClick={() => onConfirm(reason.trim())}>
          Confirmar cancelamento
        </button>
      </div>
    </Dialog>
  );
}

function PayDialog({ tab, methods, onClose }: { tab: TabDetail; methods: { id: string; name: string; kind: string }[]; onClose: () => void }) {
  const { tenantId } = useTenant();
  const action = useAction();
  const balance = tab.total_cents - tab.paid_cents;
  const [method, setMethod] = useState(methods[0]?.id ?? '');
  const [amount, setAmount] = useState((balance / 100).toFixed(2).replace('.', ','));
  const [tendered, setTendered] = useState('');
  const [payer, setPayer] = useState('');
  const [people, setPeople] = useState(1);
  const [key, setKey] = useState(() => newIdempotencyKey('pay'));
  const [done, setDone] = useState<string | null>(null);
  const isCash = methods.find((m) => m.id === method)?.kind === 'dinheiro';
  const parts = useMemo(() => (people > 1 ? splitEvenly(balance, people) : []), [balance, people]);
  const amountCents = parseCents(amount) ?? 0;
  const tenderedCents = parseCents(tendered);
  const change = isCash && tenderedCents != null ? tenderedCents - amountCents : 0;

  return (
    <Dialog open onClose={onClose} title={`Receber · saldo ${formatCents(balance)}`}>
      {done ? (
        <div className="at-form">
          <p className="at-ok">{done}</p>
          <button type="button" className="at-btn at-btn--primary" onClick={onClose}>
            Concluir
          </button>
        </div>
      ) : (
        <div className="at-form">
          {methods.length === 0 ? <p className="at-error">Nenhuma forma de pagamento habilitada para o atendimento.</p> : null}
          <label className="at-field">
            Dividir conta entre
            <input className="at-input" type="number" min={1} max={30} value={people} onChange={(e) => setPeople(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} />
          </label>
          {parts.length ? (
            <div className="at-row" aria-label="Partes">
              {parts.map((p, i) => (
                <button key={i} type="button" className="at-btn at-btn--small" onClick={() => (setAmount((p / 100).toFixed(2).replace('.', ',')), setPayer(`Pessoa ${i + 1}`))}>
                  Pessoa {i + 1}: {formatCents(p)}
                </button>
              ))}
            </div>
          ) : null}
          <label className="at-field">
            Forma de pagamento
            <select className="at-input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="at-field">
            Valor (R$)
            <input className="at-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          {isCash ? (
            <label className="at-field">
              Valor entregue (R$)
              <input className="at-input" inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value)} />
              {change > 0 ? <small>Troco: {formatCents(change)}</small> : null}
            </label>
          ) : null}
          <label className="at-field">
            Identificação (opcional)
            <input className="at-input" value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="Ex.: Pessoa 1" />
          </label>
          {action.error ? <p className="at-error">{action.error.message}</p> : null}
          <button
            type="button"
            className="at-btn at-btn--primary at-btn--block"
            disabled={action.pending || !method || amountCents <= 0 || amountCents > balance || (isCash && tenderedCents != null && tenderedCents < amountCents)}
            onClick={() =>
              void action.run(
                () => receivePayment(tenantId, { tabId: tab.id, methodId: method, amountCents, tenderedCents: isCash ? (tenderedCents ?? amountCents) : null, payer, key }),
                {
                  onSuccess: (r) => {
                    setKey(newIdempotencyKey('pay'));
                    setDone(
                      `Recebido ${formatCents(amountCents)} (recibo nº ${r.payment.receipt_number}).${r.payment.change_cents ? ` Troco: ${formatCents(r.payment.change_cents)}.` : ''}${r.closed ? ' Comanda quitada e mesa liberada.' : ''}`,
                    );
                  },
                },
              )
            }
          >
            {action.pending ? 'Registrando…' : `Confirmar ${formatCents(amountCents)}`}
          </button>
        </div>
      )}
    </Dialog>
  );
}
