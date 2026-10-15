'use client';

import { useState } from 'react';
import { formatDateTime } from '@/core/dates';
import { formatCents, parseCents } from '@/core/money';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { newIdempotencyKey, useAction } from '@/core/ui/useAction';
import { addQuotation, createPurchaseRequest, decidePurchase, issuePurchaseOrder, registerReceipt } from '@/apps/financeiro/actions';
import type { PurchaseOrder, PurchaseRequest, Supplier } from '@/apps/financeiro/queries';
import { Badge, Empty, ExternalNotice, PageHead, Panel, STATUS_LABEL, fmtDay, statusTone } from '@/apps/financeiro/ui';

type Material = { id: string; name: string; unit: string };
type Line = { material_id: string; description: string; quantity: string; unit: string };
const UNITS = ['un', 'kg', 'g', 'l', 'ml', 'cx', 'pct', 'm'];

/**
 * Compras: solicitação → cotações → aprovação (sem autoaprovação) → pedido
 * ao fornecedor → conferência do recebimento (gera estoque e contas a pagar
 * quando esses processos são internos).
 */
export function Purchases({
  requests,
  orders,
  suppliers,
  materials,
  locations,
  names,
  external,
  stockInternal,
}: {
  requests: PurchaseRequest[];
  orders: PurchaseOrder[];
  suppliers: Supplier[];
  materials: Material[];
  locations: { id: string; name: string }[];
  names: Record<string, string>;
  external: boolean;
  stockInternal: boolean;
}) {
  const { tenantId, timezone, userId } = useTenant();
  const canRequest = usePermission('financeiro.compras.solicitar') === 'direct' && !external;
  const canQuote = usePermission('financeiro.compras.cotar') === 'direct' && !external;
  const approveMode = usePermission('financeiro.compras.aprovar');
  const canBuy = usePermission('financeiro.compras.comprar') === 'direct' && !external;
  const receiveMode = usePermission('financeiro.recebimento.conferir');
  const stockEntryMode = usePermission('estoque.entrada.registrar');
  const canReceive = receiveMode === 'direct' || stockEntryMode === 'direct';
  const action = useAction();
  const [tab, setTab] = useState<'requests' | 'orders'>('requests');

  return (
    <div className="fn-stack">
      <PageHead
        title="Compras"
        subtitle="Solicitação, cotação, aprovação, pedido e recebimento."
        actions={
          <div className="fn-seg" role="group" aria-label="Seção">
            <button type="button" aria-pressed={tab === 'requests'} onClick={() => setTab('requests')}>
              Solicitações ({requests.filter((r) => ['requested', 'quoting', 'approved'].includes(r.status)).length})
            </button>
            <button type="button" aria-pressed={tab === 'orders'} onClick={() => setTab('orders')}>
              Pedidos ({orders.filter((o) => o.status !== 'received' && o.status !== 'cancelled').length})
            </button>
          </div>
        }
      />
      {external ? <ExternalNotice label="O processo de compras" /> : null}
      {action.error ? <p className="fn-error">{action.error.message}</p> : null}

      {tab === 'requests' ? (
        <div className="fn-split">
          <div className="fn-stack">
            {requests.length === 0 ? <Empty>Nenhuma solicitação de compra.</Empty> : null}
            {requests.map((r) => (
              <RequestCard
                key={r.id}
                r={r}
                suppliers={suppliers}
                requester={names[r.requested_by] ?? '—'}
                mine={r.requested_by === userId}
                canQuote={canQuote}
                approveMode={approveMode}
                canBuy={canBuy}
                timezone={timezone}
                action={action}
              />
            ))}
          </div>
          {canRequest ? <NewRequest materials={materials} action={action} /> : null}
        </div>
      ) : (
        <div className="fn-stack">
          {orders.length === 0 ? <Empty>Nenhum pedido de compra emitido.</Empty> : null}
          {orders.map((o) => (
            <OrderCard key={o.id} o={o} locations={locations} canReceive={canReceive} stockInternal={stockInternal} action={action} />
          ))}
        </div>
      )}
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </div>
  );
}

type Action = ReturnType<typeof useAction>;

function NewRequest({ materials, action }: { materials: Material[]; action: Action }) {
  const { tenantId } = useTenant();
  const empty: Line = { material_id: '', description: '', quantity: '1', unit: 'un' };
  const [lines, setLines] = useState<Line[]>([empty]);
  const [justification, setJustification] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const valid = justification.trim().length >= 3 && lines.every((l) => (l.material_id || l.description.trim()) && Number(l.quantity.replace(',', '.')) > 0);

  return (
    <Panel title="Nova solicitação de compra">
      <form
        className="fn-form"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(
            () =>
              createPurchaseRequest(
                tenantId,
                justification,
                neededBy || null,
                lines.map((l) => ({ material_id: l.material_id || null, description: l.description, quantity: Number(l.quantity.replace(',', '.')), unit: l.unit })),
              ),
            { onSuccess: () => (setLines([empty]), setJustification(''), setNeededBy('')) },
          );
        }}
      >
        {lines.map((l, i) => (
          <fieldset key={i} className="fn-line">
            <legend>Item {i + 1}</legend>
            <select
              aria-label="Material"
              value={l.material_id}
              onChange={(e) => set(i, { material_id: e.target.value, unit: materials.find((m) => m.id === e.target.value)?.unit ?? l.unit })}
            >
              <option value="">Item avulso (descrever)</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {!l.material_id ? <input aria-label="Descrição" placeholder="Descrição" value={l.description} onChange={(e) => set(i, { description: e.target.value })} /> : null}
            <input aria-label="Quantidade" inputMode="decimal" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} />
            <select aria-label="Unidade" value={l.unit} onChange={(e) => set(i, { unit: e.target.value })}>
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            <button type="button" className="fn-link" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
              Remover
            </button>
          </fieldset>
        ))}
        <button type="button" className="fn-btn fn-btn--ghost" onClick={() => setLines([...lines, empty])}>
          Adicionar item
        </button>
        <label className="fn-field">
          Justificativa
          <textarea required value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} />
        </label>
        <label className="fn-field">
          Necessário até
          <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
        </label>
        <button type="submit" className="fn-btn fn-btn--primary" disabled={action.pending || !valid}>
          Enviar solicitação
        </button>
      </form>
    </Panel>
  );
}

function RequestCard({
  r,
  suppliers,
  requester,
  mine,
  canQuote,
  approveMode,
  canBuy,
  timezone,
  action,
}: {
  r: PurchaseRequest;
  suppliers: Supplier[];
  requester: string;
  mine: boolean;
  canQuote: boolean;
  approveMode: 'direct' | 'approval' | 'deny';
  canBuy: boolean;
  timezone: string;
  action: Action;
}) {
  const { tenantId, isOwner } = useTenant();
  const [quote, setQuote] = useState({ supplier_id: suppliers[0]?.id ?? '', total: '', days: '', terms: '' });
  const [selected, setSelected] = useState(r.approved_quotation_id ?? r.quotations[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [order, setOrder] = useState({ expected: '', days: '0' });
  const pending = r.status === 'requested' || r.status === 'quoting';
  const chosen = r.quotations.find((q) => q.id === selected);
  const canDecide = pending && approveMode !== 'deny' && r.quotations.length > 0 && (!mine || isOwner);

  return (
    <article className="fn-card" id={`pr-${r.id}`}>
      <header className="fn-card-head">
        <strong>Solicitação nº {r.number}</strong>
        <Badge tone={statusTone(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
      </header>
      <p className="fn-sub">
        {requester} · {formatDateTime(r.requested_at, timezone)}
        {r.needed_by ? ` · necessário até ${fmtDay(r.needed_by)}` : ''}
        {r.material_request_id ? ' · origem: solicitação de material' : ''}
      </p>
      <p>{r.justification}</p>
      <ul className="fn-list">
        {r.items.map((i) => (
          <li key={i.id}>
            <span>{i.description}</span>
            <span>
              {i.quantity} {i.unit}
            </span>
          </li>
        ))}
      </ul>

      {r.quotations.length > 0 ? (
        <fieldset className="fn-quotes" disabled={!canDecide}>
          <legend>Cotações</legend>
          {r.quotations.map((q) => (
            <label key={q.id} className="fn-quote" data-chosen={q.id === r.approved_quotation_id}>
              <input type="radio" name={`q-${r.id}`} checked={selected === q.id} onChange={() => setSelected(q.id)} />
              <span>
                <strong>{q.supplier?.name}</strong> · {formatCents(q.total_cents)}
                {q.delivery_days != null ? ` · ${q.delivery_days} dias` : ''}
                {q.payment_terms ? ` · ${q.payment_terms}` : ''}
              </span>
            </label>
          ))}
        </fieldset>
      ) : pending ? (
        <p className="fn-sub">Aguardando cotações.</p>
      ) : null}

      {pending && canQuote ? (
        <details className="fn-more">
          <summary>Registrar cotação</summary>
          <form
            className="fn-form"
            onSubmit={(e) => {
              e.preventDefault();
              const total = parseCents(quote.total);
              if (total == null) return;
              void action.run(
                () =>
                  addQuotation(tenantId, {
                    request_id: r.id,
                    supplier_id: quote.supplier_id,
                    total_cents: total,
                    delivery_days: quote.days ? Number(quote.days) : null,
                    valid_until: null,
                    payment_terms: quote.terms,
                    notes: '',
                  }),
                { onSuccess: () => setQuote({ ...quote, total: '', days: '', terms: '' }) },
              );
            }}
          >
            {suppliers.length === 0 ? <p className="fn-sub">Cadastre fornecedores antes de cotar.</p> : null}
            <select aria-label="Fornecedor" required value={quote.supplier_id} onChange={(e) => setQuote({ ...quote, supplier_id: e.target.value })}>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="fn-grid2">
              <input aria-label="Valor total" required inputMode="decimal" placeholder="Valor total" value={quote.total} onChange={(e) => setQuote({ ...quote, total: e.target.value })} />
              <input aria-label="Prazo de entrega (dias)" inputMode="numeric" placeholder="Prazo (dias)" value={quote.days} onChange={(e) => setQuote({ ...quote, days: e.target.value })} />
            </div>
            <input aria-label="Condição de pagamento" placeholder="Condição de pagamento" value={quote.terms} onChange={(e) => setQuote({ ...quote, terms: e.target.value })} />
            <button type="submit" className="fn-btn" disabled={action.pending || !quote.supplier_id}>
              Adicionar cotação
            </button>
          </form>
        </details>
      ) : null}

      {canDecide ? (
        <div className="fn-decide">
          <input aria-label="Observação da decisão" placeholder="Observação" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="fn-row">
            <button
              type="button"
              className="fn-btn fn-btn--ghost"
              disabled={action.pending}
              onClick={() =>
                void action.run(() => decidePurchase(tenantId, r.id, null, false, note), {
                  approval: { kind: 'purchase.decide', summary: `Recusar compra nº ${r.number}`, payload: { request_id: r.id, quotation_id: '', approve: false, note } },
                })
              }
            >
              Recusar
            </button>
            <button
              type="button"
              className="fn-btn fn-btn--primary"
              disabled={action.pending || !chosen}
              onClick={() =>
                chosen &&
                void action.run(() => decidePurchase(tenantId, r.id, chosen.id, true, note), {
                  approval: {
                    kind: 'purchase.decide',
                    summary: `Aprovar compra nº ${r.number} com ${chosen.supplier?.name ?? 'fornecedor'} (${formatCents(chosen.total_cents)})`,
                    amountCents: chosen.total_cents,
                    payload: { request_id: r.id, quotation_id: chosen.id, approve: true, note },
                  },
                })
              }
            >
              {approveMode === 'approval' ? 'Pedir aprovação' : 'Aprovar cotação'}
            </button>
          </div>
        </div>
      ) : pending && mine && !isOwner && r.quotations.length > 0 ? (
        <p className="fn-sub">Quem solicita não aprova a própria compra.</p>
      ) : null}

      {r.status === 'approved' && canBuy ? (
        <details className="fn-more" open>
          <summary>Emitir pedido ao fornecedor</summary>
          <form
            className="fn-form"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(() =>
                issuePurchaseOrder(
                  tenantId,
                  r.id,
                  order.expected || null,
                  Number(order.days) || 0,
                  r.items.map((i) => ({ material_id: i.material_id, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price_cents: parseCents(prices[i.id]) ?? 0 })),
                ),
              );
            }}
          >
            {r.items.map((i) => (
              <label key={i.id} className="fn-field fn-field--inline">
                {i.description} ({i.quantity} {i.unit}) — preço unitário
                <input inputMode="decimal" placeholder="0,00" value={prices[i.id] ?? ''} onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value })} />
              </label>
            ))}
            <div className="fn-grid2">
              <label className="fn-field">
                Entrega prevista
                <input type="date" value={order.expected} onChange={(e) => setOrder({ ...order, expected: e.target.value })} />
              </label>
              <label className="fn-field">
                Prazo de pagamento (dias)
                <input inputMode="numeric" value={order.days} onChange={(e) => setOrder({ ...order, days: e.target.value })} />
              </label>
            </div>
            <button type="submit" className="fn-btn fn-btn--primary" disabled={action.pending}>
              Emitir pedido
            </button>
          </form>
        </details>
      ) : null}
      {r.decision_note ? <p className="fn-sub">Decisão: {r.decision_note}</p> : null}
    </article>
  );
}

function OrderCard({
  o,
  locations,
  canReceive,
  stockInternal,
  action,
}: {
  o: PurchaseOrder;
  locations: { id: string; name: string }[];
  canReceive: boolean;
  stockInternal: boolean;
  action: Action;
}) {
  const { tenantId } = useTenant();
  const open = o.status === 'issued' || o.status === 'partially_received';
  const [rows, setRows] = useState<Record<string, { qty: string; location: string; lot: string; expires: string }>>(() =>
    Object.fromEntries(o.items.map((i) => [i.id, { qty: String(Number(i.quantity) - Number(i.received_qty)), location: locations[0]?.id ?? '', lot: '', expires: '' }])),
  );
  const [invoice, setInvoice] = useState('');
  const [key, setKey] = useState(() => newIdempotencyKey('gr'));

  return (
    <article className="fn-card">
      <header className="fn-card-head">
        <strong>
          Pedido nº {o.number} · {o.supplier?.name}
        </strong>
        <Badge tone={statusTone(o.status)}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
      </header>
      <p className="fn-sub">
        Total {formatCents(o.total_cents)}
        {o.expected_on ? ` · entrega prevista ${fmtDay(o.expected_on)}` : ''}
      </p>
      <div className="fn-table-wrap">
        <table className="fn-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="fn-num">Comprado</th>
              <th className="fn-num">Recebido</th>
              {open && canReceive ? <th>Conferência</th> : null}
            </tr>
          </thead>
          <tbody>
            {o.items.map((i) => {
              const row = rows[i.id];
              return (
                <tr key={i.id}>
                  <td>{i.description}</td>
                  <td className="fn-num">
                    {i.quantity} {i.unit}
                  </td>
                  <td className="fn-num">{i.received_qty}</td>
                  {open && canReceive && row ? (
                    <td>
                      <div className="fn-receive">
                        <input aria-label="Quantidade recebida" inputMode="decimal" value={row.qty} onChange={(e) => setRows({ ...rows, [i.id]: { ...row, qty: e.target.value } })} />
                        {stockInternal && i.material_id ? (
                          <>
                            <select aria-label="Local" value={row.location} onChange={(e) => setRows({ ...rows, [i.id]: { ...row, location: e.target.value } })}>
                              {locations.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.name}
                                </option>
                              ))}
                            </select>
                            <input aria-label="Lote" placeholder="Lote" value={row.lot} onChange={(e) => setRows({ ...rows, [i.id]: { ...row, lot: e.target.value } })} />
                            <input aria-label="Validade" type="date" value={row.expires} onChange={(e) => setRows({ ...rows, [i.id]: { ...row, expires: e.target.value } })} />
                          </>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && canReceive ? (
        <div className="fn-row">
          <input aria-label="Número da nota fiscal" placeholder="Nº da nota fiscal" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
          <button
            type="button"
            className="fn-btn fn-btn--primary"
            disabled={action.pending}
            onClick={() =>
              void action.run(
                () =>
                  registerReceipt(
                    tenantId,
                    o.id,
                    o.items.map((i) => {
                      const row = rows[i.id];
                      return {
                        po_item_id: i.id,
                        quantity: Number((row?.qty ?? '0').replace(',', '.')),
                        location_id: row?.location || null,
                        lot_code: row?.lot || null,
                        expires_on: row?.expires || null,
                      };
                    }),
                    invoice,
                    '',
                    key,
                  ),
                { onSuccess: () => setKey(newIdempotencyKey('gr')) },
              )
            }
          >
            Conferir recebimento
          </button>
        </div>
      ) : null}
    </article>
  );
}
