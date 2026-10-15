'use client';

import { useMemo, useState } from 'react';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { newIdempotencyKey, useAction } from '@/core/ui/useAction';
import { blockLot, stockOut, stockTransfer } from '@/apps/estoque/actions';
import type { Location, Lot } from '@/apps/estoque/queries';
import { Badge, Empty, PageHead, Panel, daysTo, expiryTone, fmtDay, fmtQty } from '@/apps/estoque/ui';

type Op = { lot: Lot; kind: 'saida' | 'perda' | 'descarte' | 'ajuste' | 'transferencia' | 'bloquear' | 'liberar' };
const OP_LABEL: Record<Op['kind'], string> = {
  saida: 'Registrar saída',
  perda: 'Registrar perda',
  descarte: 'Registrar descarte',
  ajuste: 'Ajustar saldo',
  transferencia: 'Transferir',
  bloquear: 'Bloquear lote',
  liberar: 'Liberar lote',
};

/** Lotes com validade: saída (FEFO), perdas/descartes, ajustes, transferências e bloqueio. */
export function Lots({ lots, locations, today, external }: { lots: Lot[]; locations: Location[]; today: string; external: boolean }) {
  const { tenantId } = useTenant();
  const perms = {
    saida: usePermission('estoque.saida.registrar'),
    perda: usePermission('estoque.perda.registrar'),
    ajuste: usePermission('estoque.ajuste.registrar'),
    transferencia: usePermission('estoque.transferir'),
    bloquear: usePermission('estoque.lote.bloquear'),
  };
  const action = useAction();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'expired' | 'soon' | 'blocked'>('all');
  const [op, setOp] = useState<Op | null>(null);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [to, setTo] = useState('');
  const [key, setKey] = useState(() => newIdempotencyKey('st'));

  const list = useMemo(
    () =>
      lots.filter((l) => {
        if (q && !`${l.material?.name} ${l.lot_code ?? ''} ${l.location?.name}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (filter === 'expired') return !!l.expires_on && l.expires_on < today;
        if (filter === 'soon') return !!l.expires_on && l.expires_on >= today && daysTo(l.expires_on, today) <= 7;
        if (filter === 'blocked') return l.status === 'blocked';
        return true;
      }),
    [lots, q, filter, today],
  );

  const open = (lot: Lot, kind: Op['kind']) => {
    setOp({ lot, kind });
    setQty(kind === 'ajuste' ? '' : String(Number(lot.qty)));
    setReason('');
    setTo(locations.find((l) => l.id !== lot.location?.id)?.id ?? '');
    setKey(newIdempotencyKey('st'));
  };

  const submit = () => {
    if (!op) return;
    const n = Number(qty.replace(',', '.'));
    const name = `${op.lot.material?.name ?? 'material'}${op.lot.lot_code ? ` (lote ${op.lot.lot_code})` : ''}`;
    const done = { onSuccess: () => setOp(null) };
    if (op.kind === 'transferencia') return void action.run(() => stockTransfer(tenantId, op.lot.id, to, n, reason, key), done);
    if (op.kind === 'bloquear' || op.kind === 'liberar') {
      const blocked = op.kind === 'bloquear';
      return void action.run(() => blockLot(tenantId, op.lot.id, blocked, reason), {
        ...done,
        approval: { kind: 'lot.block', summary: `${blocked ? 'Bloquear' : 'Liberar'} ${name}`, payload: { lot_id: op.lot.id, blocked, reason } },
      });
    }
    const kind = op.kind;
    void action.run(() => stockOut(tenantId, op.lot.id, kind, n, reason, key), {
      ...done,
      approval: {
        kind: 'stock.out',
        summary: `${OP_LABEL[kind]}: ${fmtQty(n, op.lot.material?.unit)} de ${name}${reason ? ` — ${reason}` : ''}`,
        amountCents: op.lot.unit_cost_cents != null ? Math.round(Math.abs(n) * op.lot.unit_cost_cents) : null,
        payload: { lot_id: op.lot.id, kind, qty: n, reason },
      },
    });
  };

  const can = (p: 'direct' | 'approval' | 'deny') => p !== 'deny' && !external;

  return (
    <div className="es-stack">
      <PageHead
        title="Lotes e validade"
        subtitle="Bloqueados e vencidos não são liberados para consumo."
        actions={
          <>
            <input type="search" aria-label="Buscar" placeholder="Buscar material, lote ou local" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="es-seg" role="group" aria-label="Filtro">
              {(
                [
                  ['all', 'Todos'],
                  ['expired', 'Vencidos'],
                  ['soon', '7 dias'],
                  ['blocked', 'Bloqueados'],
                ] as const
              ).map(([k, v]) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                  {v}
                </button>
              ))}
            </div>
          </>
        }
      />
      {action.error ? <p className="es-error">{action.error.message}</p> : null}
      <Panel>
        {list.length === 0 ? (
          <Empty>Nenhum lote com saldo neste filtro.</Empty>
        ) : (
          <div className="es-table-wrap">
            <table className="es-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Local</th>
                  <th>Validade</th>
                  <th className="es-num">Saldo</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((l) => (
                  <tr key={l.id} data-tone={expiryTone(l.expires_on, today)}>
                    <td>
                      <strong>{l.material?.name}</strong>
                      {l.lot_code ? (
                        <>
                          <br />
                          <small>Lote {l.lot_code}</small>
                        </>
                      ) : null}
                    </td>
                    <td>{l.location?.name}</td>
                    <td>{l.expires_on ? <Badge tone={expiryTone(l.expires_on, today)}>{fmtDay(l.expires_on)}</Badge> : '—'}</td>
                    <td className="es-num">{fmtQty(l.qty, l.material?.unit)}</td>
                    <td>{l.status === 'blocked' ? <Badge tone="danger">Bloqueado{l.block_reason ? `: ${l.block_reason}` : ''}</Badge> : <Badge tone="ok">Disponível</Badge>}</td>
                    <td>
                      {external ? null : (
                        <details className="es-menu">
                          <summary>Ações</summary>
                          <div>
                            {can(perms.saida) && l.status === 'available' && !(l.expires_on && l.expires_on < today) ? (
                              <button type="button" onClick={() => open(l, 'saida')}>
                                Saída
                              </button>
                            ) : null}
                            {can(perms.transferencia) && l.status === 'available' && !(l.expires_on && l.expires_on < today) ? (
                              <button type="button" onClick={() => open(l, 'transferencia')}>
                                Transferir
                              </button>
                            ) : null}
                            {can(perms.perda) ? (
                              <>
                                <button type="button" onClick={() => open(l, 'perda')}>
                                  Perda
                                </button>
                                <button type="button" onClick={() => open(l, 'descarte')}>
                                  Descarte
                                </button>
                              </>
                            ) : null}
                            {can(perms.ajuste) ? (
                              <button type="button" onClick={() => open(l, 'ajuste')}>
                                Ajuste
                              </button>
                            ) : null}
                            {can(perms.bloquear) ? (
                              <button type="button" onClick={() => open(l, l.status === 'blocked' ? 'liberar' : 'bloquear')}>
                                {l.status === 'blocked' ? 'Liberar' : 'Bloquear'}
                              </button>
                            ) : null}
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {op ? (
        <div className="es-sheet" role="dialog" aria-label={OP_LABEL[op.kind]}>
          <h2 className="es-h2">{OP_LABEL[op.kind]}</h2>
          <p className="es-sub">
            {op.lot.material?.name} · saldo {fmtQty(op.lot.qty, op.lot.material?.unit)} · {op.lot.location?.name}
          </p>
          {op.kind !== 'bloquear' && op.kind !== 'liberar' ? (
            <label className="es-field">
              {op.kind === 'ajuste' ? 'Diferença (use negativo para reduzir)' : 'Quantidade'}
              <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
          ) : null}
          {op.kind === 'transferencia' ? (
            <label className="es-field">
              Destino
              <select value={to} onChange={(e) => setTo(e.target.value)}>
                {locations
                  .filter((l) => l.id !== op.lot.location?.id)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          {op.kind !== 'liberar' ? (
            <label className="es-field">
              Motivo{op.kind === 'saida' || op.kind === 'transferencia' ? ' (opcional)' : ''}
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          ) : null}
          <div className="es-row">
            <button type="button" className="es-btn es-btn--ghost" onClick={() => setOp(null)}>
              Voltar
            </button>
            <button type="button" className="es-btn es-btn--primary" disabled={action.pending} onClick={submit}>
              Confirmar
            </button>
          </div>
        </div>
      ) : null}
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={() => (action.clearApproval(), setOp(null))} />
    </div>
  );
}
