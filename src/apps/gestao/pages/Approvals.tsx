'use client';

import { useState } from 'react';
import { cancelApproval, decideApproval, executeApproval } from '@/core/actions';
import { formatDateTime } from '@/core/dates';
import { formatCents } from '@/core/money';
import { useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { Badge, Empty, MODULE_LABEL, PageHead } from '@/apps/gestao/ui';

export type ApprovalItem = {
  id: string;
  module: string;
  permission_label: string;
  summary: string;
  amount_cents: number | null;
  reason: string | null;
  status: string;
  requested_by_name: string | null;
  requested_at: string;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  error: string | null;
  is_mine: boolean;
  can_decide: boolean;
  can_execute: boolean;
};

const STATUS: Record<string, [string, 'ok' | 'warn' | 'danger' | 'accent' | undefined]> = {
  pending: ['Pendente', 'warn'],
  approved: ['Aprovada — aguardando execução', 'accent'],
  executed: ['Executada', 'ok'],
  rejected: ['Recusada', 'danger'],
  cancelled: ['Cancelada', undefined],
  expired: ['Expirada', undefined],
  failed: ['Falhou na execução', 'danger'],
};

export function ApprovalsPage({ items }: { items: ApprovalItem[] }) {
  const { tenantId, timezone } = useTenant();
  const action = useAction();
  const [filter, setFilter] = useState<'todas' | 'decidir' | 'minhas'>('decidir');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const shown = items.filter((i) => (filter === 'decidir' ? i.can_decide : filter === 'minhas' ? i.is_mine : true));

  return (
    <>
      <PageHead title="Aprovações" subtitle="Solicitações encaminhadas à cadeia de responsáveis. Aprovação pontual não concede poderes permanentes." />
      <div className="gs-tabs" role="group" aria-label="Filtro">
        {(
          [
            ['decidir', 'Para eu decidir'],
            ['minhas', 'Minhas solicitações'],
            ['todas', 'Todas (30 dias)'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>
      {action.error ? <p className="gs-msg gs-msg--error">{action.error.message}</p> : null}
      {shown.length === 0 ? <Empty>Nenhuma solicitação.</Empty> : null}
      <div className="gs-grid">
        {shown.map((item) => {
          const [label, tone] = STATUS[item.status] ?? [item.status, undefined];
          return (
            <article key={item.id} className="gs-card">
              <div className="gs-cardhead">
                <Badge>{MODULE_LABEL[item.module] ?? item.module}</Badge>
                <Badge tone={tone}>{label}</Badge>
              </div>
              <h2 className="gs-h2">{item.summary}</h2>
              <ul className="gs-list">
                <li>
                  <span className="gs-meta">Permissão</span>
                  <span>{item.permission_label}</span>
                </li>
                {item.amount_cents != null ? (
                  <li>
                    <span className="gs-meta">Valor</span>
                    <strong>{formatCents(item.amount_cents)}</strong>
                  </li>
                ) : null}
                <li>
                  <span className="gs-meta">Solicitante</span>
                  <span>
                    {item.requested_by_name ?? '—'} · {formatDateTime(item.requested_at, timezone)}
                  </span>
                </li>
                {item.reason ? (
                  <li>
                    <span className="gs-meta">Justificativa</span>
                    <span>{item.reason}</span>
                  </li>
                ) : null}
                {item.decided_by_name ? (
                  <li>
                    <span className="gs-meta">Decisão</span>
                    <span>
                      {item.decided_by_name} · {formatDateTime(item.decided_at, timezone)}
                      {item.decision_note ? ` — ${item.decision_note}` : ''}
                    </span>
                  </li>
                ) : null}
                {item.error ? (
                  <li>
                    <span className="gs-meta">Erro</span>
                    <span className="gs-msg--error">{item.error}</span>
                  </li>
                ) : null}
              </ul>
              {item.can_decide ? (
                <div className="gs-form">
                  <label className="gs-field">
                    Observação
                    <input value={notes[item.id] ?? ''} onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })} />
                  </label>
                  <div className="gs-row">
                    <button
                      type="button"
                      className="gs-btn gs-btn--primary"
                      disabled={action.pending}
                      onClick={() => void action.run(() => decideApproval(tenantId, item.id, true, notes[item.id] ?? ''))}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      className="gs-btn gs-btn--danger"
                      disabled={action.pending}
                      onClick={() => void action.run(() => decideApproval(tenantId, item.id, false, notes[item.id] ?? ''))}
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              ) : null}
              {item.can_execute ? (
                <button
                  type="button"
                  className="gs-btn gs-btn--primary"
                  disabled={action.pending}
                  onClick={() => void action.run(() => executeApproval(tenantId, item.id))}
                >
                  Executar agora
                </button>
              ) : null}
              {item.is_mine && (item.status === 'pending' || item.status === 'approved') ? (
                <button
                  type="button"
                  className="gs-btn gs-btn--small"
                  disabled={action.pending}
                  onClick={() => void action.run(() => cancelApproval(tenantId, item.id))}
                >
                  Cancelar solicitação
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );
}
