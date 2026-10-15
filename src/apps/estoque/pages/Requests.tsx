'use client';

import { useState } from 'react';
import { formatDateTime } from '@/core/dates';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { createMaterialRequest, fulfillRequest, requestToPurchase } from '@/apps/estoque/actions';
import type { MaterialRequest } from '@/apps/estoque/queries';
import { Badge, Empty, PageHead, Panel, REQ_LABEL, fmtDay, fmtQty } from '@/apps/estoque/ui';

/** Solicitações dos setores: separar e entregar (FEFO) ou encaminhar para compra. */
export function Requests({
  rows,
  names,
  available,
  materials,
  sectors,
  external,
}: {
  rows: MaterialRequest[];
  names: Record<string, string>;
  available: Record<string, number>;
  materials: { id: string; name: string; unit: string }[];
  sectors: { id: string; name: string }[];
  external: boolean;
}) {
  const { tenantId, timezone } = useTenant();
  const canAttend = usePermission('estoque.solicitacao.atender') === 'direct' && !external;
  const canCreate = usePermission('estoque.solicitacao.criar') === 'direct';
  const action = useAction();
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [lines, setLines] = useState([{ material_id: materials[0]?.id ?? '', quantity: '1' }]);
  const [sector, setSector] = useState('');
  const [notes, setNotes] = useState('');
  const pending = rows.filter((r) => r.status === 'requested' || r.status === 'authorized');
  const history = rows.filter((r) => !pending.includes(r));

  const card = (r: MaterialRequest) => {
    const missing = r.items.filter((i) => (available[i.material_id] ?? 0) < Number(i.quantity) - Number(i.fulfilled_qty));
    return (
      <li key={r.id} className="es-card">
        <div className="es-row es-between">
          <strong>
            Nº {r.number}
            {r.sector ? ` · ${r.sector.name}` : ''}
          </strong>
          <Badge tone={r.status === 'fulfilled' ? 'ok' : r.status === 'rejected' ? 'danger' : r.status === 'authorized' ? 'accent' : 'warn'}>{REQ_LABEL[r.status] ?? r.status}</Badge>
        </div>
        <small>
          {names[r.requested_by] ?? '—'} · {formatDateTime(r.requested_at, timezone)}
          {r.needed_by ? ` · para ${fmtDay(r.needed_by)}` : ''}
        </small>
        <ul className="es-list">
          {r.items.map((i) => (
            <li key={i.material_id} data-missing={pending.includes(r) && missing.includes(i)}>
              <span>{i.material?.name}</span>
              <span>
                {fmtQty(i.quantity, i.material?.unit)}
                {pending.includes(r) ? <small> · disponível {fmtQty(available[i.material_id] ?? 0)}</small> : null}
              </span>
            </li>
          ))}
        </ul>
        {r.notes ? <small>Obs.: {r.notes}</small> : null}
        {r.decision_note ? <small>Decisão: {r.decision_note}</small> : null}
        {msg[r.id] ? <p className="es-sub">{msg[r.id]}</p> : null}
        {pending.includes(r) && canAttend ? (
          <div className="es-row">
            <button
              type="button"
              className="es-btn es-btn--primary"
              disabled={action.pending || missing.length > 0}
              onClick={() =>
                void action.run(() => fulfillRequest(tenantId, r.id), {
                  onSuccess: (d) => setMsg({ ...msg, [r.id]: d.fulfilled ? 'Separado e entregue (vence primeiro, sai primeiro).' : 'Saldo insuficiente para atender.' }),
                })
              }
            >
              Separar e entregar
            </button>
            {missing.length > 0 ? (
              <button type="button" className="es-btn" disabled={action.pending} onClick={() => void action.run(() => requestToPurchase(tenantId, r.id, ''))}>
                Encaminhar para compra
              </button>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="es-stack">
      <PageHead title="Solicitações de materiais" subtitle="Pedidos da cozinha e dos setores; sem saldo, vira solicitação de compra." />
      {action.error ? <p className="es-error">{action.error.message}</p> : null}
      <div className="es-split">
        <div className="es-stack">
          <Panel title={`Pendentes (${pending.length})`}>{pending.length ? <ul className="es-cards">{pending.map(card)}</ul> : <Empty>Nada para atender.</Empty>}</Panel>
          <Panel title="Histórico">{history.length ? <ul className="es-cards">{history.map(card)}</ul> : <Empty>Sem histórico.</Empty>}</Panel>
        </div>
        {canCreate ? (
          <Panel title="Nova solicitação">
            <form
              className="es-form"
              onSubmit={(e) => {
                e.preventDefault();
                const items = lines.map((l) => ({ material_id: l.material_id, quantity: Number(l.quantity.replace(',', '.')) })).filter((l) => l.material_id && l.quantity > 0);
                if (!items.length) return;
                void action.run(() => createMaterialRequest(tenantId, sector || null, items, notes, null), {
                  onSuccess: () => (setLines([{ material_id: materials[0]?.id ?? '', quantity: '1' }]), setNotes('')),
                });
              }}
            >
              {lines.map((l, i) => (
                <div key={i} className="es-row">
                  <select aria-label="Material" value={l.material_id} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, material_id: e.target.value } : x)))}>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.unit})
                      </option>
                    ))}
                  </select>
                  <input className="es-qty" aria-label="Quantidade" inputMode="decimal" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                  <button type="button" className="es-link" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                    Remover
                  </button>
                </div>
              ))}
              <button type="button" className="es-btn es-btn--ghost" onClick={() => setLines([...lines, { material_id: materials[0]?.id ?? '', quantity: '1' }])}>
                Adicionar material
              </button>
              <label className="es-field">
                Setor
                <select value={sector} onChange={(e) => setSector(e.target.value)}>
                  <option value="">—</option>
                  {sectors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="es-field">
                Observação
                <input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <button type="submit" className="es-btn es-btn--primary" disabled={action.pending || materials.length === 0}>
                Enviar
              </button>
            </form>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
