'use client';

import { useState } from 'react';
import { formatDateTime } from '@/core/dates';
import { parseCents } from '@/core/money';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { newIdempotencyKey, useAction } from '@/core/ui/useAction';
import { receivePurchase, stockEntry } from '@/apps/estoque/actions';
import type { Location, Material, Movement } from '@/apps/estoque/queries';
import { Badge, Empty, PageHead, Panel, fmtDay, fmtQty } from '@/apps/estoque/ui';

type Order = {
  id: string;
  number: number;
  status: string;
  expected_on: string | null;
  supplier: { name: string } | null;
  items: { id: string; material_id: string | null; description: string; quantity: number; unit: string; received_qty: number }[];
};

export function Entry({ materials, locations, orders, recent, external }: { materials: Material[]; locations: Location[]; orders: Order[]; recent: Movement[]; external: boolean }) {
  const { tenantId, timezone } = useTenant();
  const canEntry = usePermission('estoque.entrada.registrar') === 'direct';
  const action = useAction();
  const [form, setForm] = useState({ material_id: materials[0]?.id ?? '', location_id: locations[0]?.id ?? '', qty: '', lot_code: '', expires_on: '', cost: '', reason: '' });
  const [key, setKey] = useState(() => newIdempotencyKey('in'));
  const [ok, setOk] = useState<string | null>(null);
  const material = materials.find((m) => m.id === form.material_id);

  return (
    <div className="es-stack">
      <PageHead title="Entradas" subtitle="Recebimento de pedidos de compra e entradas avulsas, com lote e validade." />
      {action.error ? <p className="es-error">{action.error.message}</p> : null}
      {ok ? <p className="es-ok">{ok}</p> : null}
      <div className="es-split">
        <div className="es-stack">
          <Panel title={`Pedidos de compra a receber (${orders.length})`}>
            {orders.length === 0 ? <Empty>Nenhum pedido aguardando recebimento.</Empty> : null}
            {orders.map((o) => (
              <ReceiveOrder key={o.id} order={o} locations={locations} canEntry={canEntry} action={action} onDone={() => setOk(`Pedido nº ${o.number} conferido.`)} />
            ))}
          </Panel>
          <Panel title="Últimas entradas">
            {recent.length === 0 ? <Empty>Nenhuma entrada.</Empty> : null}
            <ul className="es-list">
              {recent.map((m) => (
                <li key={m.id}>
                  <span>
                    {fmtQty(m.qty, m.material?.unit)} {m.material?.name} → {m.to?.name}
                  </span>
                  <small>{formatDateTime(m.created_at, timezone)}</small>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        {canEntry && !external ? (
          <Panel title="Entrada avulsa">
            {materials.length === 0 || locations.length === 0 ? <p className="es-sub">Cadastre materiais e locais antes de registrar entradas.</p> : null}
            <form
              className="es-form"
              onSubmit={(e) => {
                e.preventDefault();
                const qty = Number(form.qty.replace(',', '.'));
                if (!(qty > 0)) return;
                void action.run(
                  () =>
                    stockEntry(
                      tenantId,
                      {
                        material_id: form.material_id,
                        location_id: form.location_id,
                        qty,
                        lot_code: form.lot_code,
                        expires_on: form.expires_on || null,
                        unit_cost_cents: parseCents(form.cost),
                        reason: form.reason,
                      },
                      key,
                    ),
                  {
                    onSuccess: () => {
                      setOk(`Entrada de ${fmtQty(qty, material?.unit)} ${material?.name ?? ''} registrada.`);
                      setForm({ ...form, qty: '', lot_code: '', expires_on: '', cost: '', reason: '' });
                      setKey(newIdempotencyKey('in'));
                    },
                  },
                );
              }}
            >
              <label className="es-field">
                Material
                <select value={form.material_id} onChange={(e) => setForm({ ...form, material_id: e.target.value })}>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit}){m.perishable ? ' · perecível' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="es-field">
                Local
                <select value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })}>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="es-grid2">
                <label className="es-field">
                  Quantidade ({material?.unit ?? 'un'})
                  <input required inputMode="decimal" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
                </label>
                <label className="es-field">
                  Custo unitário
                  <input inputMode="decimal" placeholder="0,00" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
                </label>
                <label className="es-field">
                  Lote
                  <input value={form.lot_code} onChange={(e) => setForm({ ...form, lot_code: e.target.value })} />
                </label>
                <label className="es-field">
                  Validade{material?.perishable ? ' *' : ''}
                  <input type="date" required={!!material?.perishable} value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} />
                </label>
              </div>
              <label className="es-field">
                Motivo / origem
                <input placeholder="Ex.: doação, devolução, compra à vista" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </label>
              <button type="submit" className="es-btn es-btn--primary" disabled={action.pending || !form.material_id || !form.location_id}>
                Registrar entrada
              </button>
            </form>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function ReceiveOrder({ order, locations, canEntry, action, onDone }: { order: Order; locations: Location[]; canEntry: boolean; action: ReturnType<typeof useAction>; onDone: () => void }) {
  const { tenantId } = useTenant();
  const [rows, setRows] = useState(() =>
    Object.fromEntries(order.items.map((i) => [i.id, { qty: String(Number(i.quantity) - Number(i.received_qty)), location: locations[0]?.id ?? '', lot: '', expires: '' }])),
  );
  const [invoice, setInvoice] = useState('');
  const [key, setKey] = useState(() => newIdempotencyKey('gr'));
  return (
    <details className="es-order">
      <summary>
        <strong>
          Pedido nº {order.number} · {order.supplier?.name}
        </strong>
        <Badge tone={order.status === 'partially_received' ? 'warn' : undefined}>{order.status === 'partially_received' ? 'Parcial' : 'Emitido'}</Badge>
        {order.expected_on ? <small>previsto {fmtDay(order.expected_on)}</small> : null}
      </summary>
      <div className="es-stack">
        {order.items.map((i) => {
          const r = rows[i.id];
          if (!r) return null;
          const set = (patch: Partial<typeof r>) => setRows({ ...rows, [i.id]: { ...r, ...patch } });
          return (
            <fieldset key={i.id} className="es-receive">
              <legend>
                {i.description} — comprado {fmtQty(i.quantity, i.unit)}, recebido {fmtQty(i.received_qty, i.unit)}
              </legend>
              <input aria-label="Quantidade recebida" inputMode="decimal" value={r.qty} onChange={(e) => set({ qty: e.target.value })} disabled={!canEntry} />
              {i.material_id ? (
                <>
                  <select aria-label="Local" value={r.location} onChange={(e) => set({ location: e.target.value })} disabled={!canEntry}>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <input aria-label="Lote" placeholder="Lote" value={r.lot} onChange={(e) => set({ lot: e.target.value })} disabled={!canEntry} />
                  <input aria-label="Validade" type="date" value={r.expires} onChange={(e) => set({ expires: e.target.value })} disabled={!canEntry} />
                </>
              ) : (
                <small>Item sem material vinculado: não entra no estoque.</small>
              )}
            </fieldset>
          );
        })}
        {canEntry ? (
          <div className="es-row">
            <input aria-label="Nota fiscal" placeholder="Nº da nota fiscal" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
            <button
              type="button"
              className="es-btn es-btn--primary"
              disabled={action.pending}
              onClick={() =>
                void action.run(
                  () =>
                    receivePurchase(
                      tenantId,
                      order.id,
                      order.items.map((i) => ({
                        po_item_id: i.id,
                        quantity: Number((rows[i.id]?.qty ?? '0').replace(',', '.')),
                        location_id: rows[i.id]?.location || null,
                        lot_code: rows[i.id]?.lot || null,
                        expires_on: rows[i.id]?.expires || null,
                      })),
                      invoice,
                      key,
                    ),
                  { onSuccess: () => (setKey(newIdempotencyKey('gr')), onDone()) },
                )
              }
            >
              Conferir e dar entrada
            </button>
          </div>
        ) : null}
      </div>
    </details>
  );
}
