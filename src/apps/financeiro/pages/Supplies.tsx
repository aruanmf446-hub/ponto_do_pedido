'use client';

import { useState } from 'react';
import { formatDateTime } from '@/core/dates';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { authorizeSupply } from '@/apps/financeiro/actions';
import type { SupplyRequest } from '@/apps/financeiro/queries';
import { Badge, Empty, PageHead, Panel, STATUS_LABEL, fmtDay, statusTone } from '@/apps/financeiro/ui';

/** Autorização de atendimento de suprimentos solicitados pelos setores. */
export function Supplies({ rows, names }: { rows: SupplyRequest[]; names: Record<string, string> }) {
  const { tenantId, timezone } = useTenant();
  const canAuthorize = usePermission('financeiro.suprimentos.autorizar') === 'direct';
  const action = useAction();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const pending = rows.filter((r) => r.status === 'requested');
  const done = rows.filter((r) => r.status !== 'requested');

  const card = (r: SupplyRequest) => (
    <li key={r.id} className="fn-card">
      <header className="fn-card-head">
        <strong>
          Material nº {r.number}
          {r.sector ? ` · ${r.sector.name}` : ''}
        </strong>
        <Badge tone={statusTone(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
      </header>
      <p className="fn-sub">
        {names[r.requested_by] ?? '—'} · {formatDateTime(r.requested_at, timezone)}
        {r.needed_by ? ` · para ${fmtDay(r.needed_by)}` : ''}
      </p>
      <ul className="fn-list">
        {r.items.map((i, n) => (
          <li key={n}>
            <span>{i.material?.name}</span>
            <span>
              {i.quantity} {i.material?.unit}
            </span>
          </li>
        ))}
      </ul>
      {r.notes ? <p className="fn-sub">Obs.: {r.notes}</p> : null}
      {r.status === 'requested' && canAuthorize ? (
        <div className="fn-decide">
          <input aria-label="Observação" placeholder="Observação" value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
          <div className="fn-row">
            <button type="button" className="fn-btn fn-btn--ghost" disabled={action.pending} onClick={() => void action.run(() => authorizeSupply(tenantId, r.id, false, notes[r.id] ?? ''))}>
              Recusar
            </button>
            <button type="button" className="fn-btn fn-btn--primary" disabled={action.pending} onClick={() => void action.run(() => authorizeSupply(tenantId, r.id, true, notes[r.id] ?? ''))}>
              Autorizar atendimento
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );

  return (
    <div className="fn-stack">
      <PageHead title="Suprimentos" subtitle="Solicitações de materiais dos setores. O Estoque separa e entrega após a autorização." />
      {action.error ? <p className="fn-error">{action.error.message}</p> : null}
      <Panel title={`Aguardando autorização (${pending.length})`}>{pending.length ? <ul className="fn-cards">{pending.map(card)}</ul> : <Empty>Nada pendente.</Empty>}</Panel>
      <Panel title="Histórico">{done.length ? <ul className="fn-cards">{done.map(card)}</ul> : <Empty>Sem histórico.</Empty>}</Panel>
    </div>
  );
}
