'use client';

import { useState } from 'react';
import { formatDateTime } from '@/core/dates';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { closeInventory, countLine, startInventory } from '@/apps/estoque/actions';
import type { Location } from '@/apps/estoque/queries';
import { Badge, Empty, PageHead, Panel, fmtDay, fmtQty } from '@/apps/estoque/ui';

type Count = {
  id: string;
  status: string;
  notes: string | null;
  started_at: string;
  closed_at: string | null;
  location: { name: string } | null;
  lines: {
    id: string;
    expected_qty: number;
    counted_qty: number | null;
    lot: { lot_code: string | null; expires_on: string | null; location: { name: string } | null } | null;
    material: { name: string; unit: string } | null;
  }[];
};

/** Conferência: contagem cega por lote; divergências viram ajustes no fechamento. */
export function Inventory({ counts, locations, external }: { counts: Count[]; locations: Location[]; external: boolean }) {
  const { tenantId, timezone } = useTenant();
  const canRun = usePermission('estoque.inventario.executar') === 'direct' && !external;
  const action = useAction();
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [blind, setBlind] = useState(true);
  const open = counts.find((c) => c.status === 'open');
  const closed = counts.filter((c) => c.status !== 'open');

  return (
    <div className="es-stack">
      <PageHead title="Inventário e conferência" subtitle="Conte o que existe; o sistema compara com o saldo e ajusta no fechamento." />
      {action.error ? <p className="es-error">{action.error.message}</p> : null}
      {open ? (
        <Panel
          title={`Conferência aberta ${open.location ? `· ${open.location.name}` : '· geral'}`}
          actions={
            <label className="es-check">
              <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} /> Contagem cega
            </label>
          }
        >
          <p className="es-sub">
            Iniciada em {formatDateTime(open.started_at, timezone)} · {open.lines.filter((l) => l.counted_qty != null).length}/{open.lines.length} itens contados
          </p>
          {open.lines.length === 0 ? <Empty>Nenhum lote com saldo neste local.</Empty> : null}
          <ul className="es-countlist">
            {open.lines.map((l) => {
              const diff = l.counted_qty != null ? Number(l.counted_qty) - Number(l.expected_qty) : null;
              return (
                <li key={l.id} data-done={l.counted_qty != null} data-diff={diff != null && diff !== 0}>
                  <div>
                    <strong>{l.material?.name}</strong>
                    <small>
                      {l.lot?.location?.name}
                      {l.lot?.lot_code ? ` · lote ${l.lot.lot_code}` : ''}
                      {l.lot?.expires_on ? ` · val. ${fmtDay(l.lot.expires_on)}` : ''}
                      {!blind ? ` · sistema ${fmtQty(l.expected_qty, l.material?.unit)}` : ''}
                    </small>
                  </div>
                  {canRun ? (
                    <form
                      className="es-row"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const n = Number((values[l.id] ?? '').replace(',', '.'));
                        if (Number.isFinite(n) && n >= 0 && (values[l.id] ?? '') !== '') void action.run(() => countLine(tenantId, l.id, n));
                      }}
                    >
                      <input
                        className="es-qty"
                        aria-label={`Contagem de ${l.material?.name}`}
                        inputMode="decimal"
                        placeholder={l.counted_qty != null ? String(l.counted_qty) : l.material?.unit}
                        value={values[l.id] ?? ''}
                        onChange={(e) => setValues({ ...values, [l.id]: e.target.value })}
                      />
                      <button type="submit" className="es-btn" disabled={action.pending}>
                        {l.counted_qty != null ? 'Recontar' : 'Registrar'}
                      </button>
                    </form>
                  ) : null}
                  {l.counted_qty != null ? <Badge tone={diff ? 'warn' : 'ok'}>{diff ? `${diff > 0 ? '+' : ''}${fmtQty(diff, l.material?.unit)}` : 'Confere'}</Badge> : null}
                </li>
              );
            })}
          </ul>
          {canRun ? (
            <button
              type="button"
              className="es-btn es-btn--primary"
              disabled={action.pending || open.lines.some((l) => l.counted_qty == null)}
              onClick={() =>
                void action.run(() => closeInventory(tenantId, open.id), {
                  approval: { kind: 'inventory.close', summary: `Fechar conferência ${open.location?.name ?? 'geral'} com ajustes de divergência`, payload: { count_id: open.id } },
                })
              }
            >
              Fechar conferência e ajustar saldos
            </button>
          ) : null}
        </Panel>
      ) : canRun ? (
        <Panel title="Iniciar conferência">
          <form
            className="es-form es-form--inline"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(() => startInventory(tenantId, location || null, notes));
            }}
          >
            <select aria-label="Local" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">Todos os locais</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <input aria-label="Observação" placeholder="Observação" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button type="submit" className="es-btn es-btn--primary" disabled={action.pending}>
              Iniciar
            </button>
          </form>
        </Panel>
      ) : null}
      <Panel title="Conferências anteriores">
        {closed.length === 0 ? <Empty>Nenhuma conferência fechada.</Empty> : null}
        <ul className="es-list">
          {closed.map((c) => (
            <li key={c.id}>
              <span>
                {c.location?.name ?? 'Geral'} · {formatDateTime(c.started_at, timezone)}
              </span>
              <span>
                {c.lines.filter((l) => l.counted_qty != null && Number(l.counted_qty) !== Number(l.expected_qty)).length} divergência(s) ·{' '}
                {c.status === 'closed' ? `fechada ${formatDateTime(c.closed_at, timezone)}` : 'cancelada'}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </div>
  );
}
