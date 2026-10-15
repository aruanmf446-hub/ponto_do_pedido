'use client';

import { useState } from 'react';
import { formatCents, parseCents } from '@/core/money';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { createReceivable, settleReceivable } from '@/apps/financeiro/actions';
import type { Receivable } from '@/apps/financeiro/queries';
import { Badge, Empty, ExternalNotice, PageHead, Panel, STATUS_LABEL, fmtDay, statusTone } from '@/apps/financeiro/ui';

export function Receivables({ rows, external, today }: { rows: Receivable[]; external: boolean; today: string }) {
  const { tenantId } = useTenant();
  const canManage = usePermission('financeiro.receber.gerir') === 'direct' && !external;
  const action = useAction();
  const [form, setForm] = useState({ customer: '', description: '', amount: '', due: today });
  const amount = parseCents(form.amount);
  const open = rows.filter((r) => r.status === 'open');

  return (
    <div className="fn-stack">
      <PageHead title="Contas a receber" subtitle={`Em aberto: ${formatCents(open.reduce((a, r) => a + Number(r.amount_cents), 0))}`} />
      {external ? <ExternalNotice label="Contas a receber" /> : null}
      {action.error ? <p className="fn-error">{action.error.message}</p> : null}
      <div className="fn-split">
        <Panel title="Recebíveis">
          {rows.length === 0 ? (
            <Empty>Nenhum recebível registrado. Vendas do salão e delivery entram pelo Caixa.</Empty>
          ) : (
            <div className="fn-table-wrap">
              <table className="fn-table">
                <thead>
                  <tr>
                    <th>Vencimento</th>
                    <th>Cliente / descrição</th>
                    <th>Situação</th>
                    <th className="fn-num">Valor</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} data-overdue={r.status === 'open' && r.due_date < today}>
                      <td>{fmtDay(r.due_date)}</td>
                      <td>
                        <strong>{r.customer_name}</strong>
                        <br />
                        <small>{r.description}</small>
                      </td>
                      <td>
                        <Badge tone={statusTone(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                      </td>
                      <td className="fn-num">{formatCents(r.amount_cents)}</td>
                      <td className="fn-actions">
                        {r.status === 'open' && canManage ? (
                          <button type="button" className="fn-btn fn-btn--primary" disabled={action.pending} onClick={() => void action.run(() => settleReceivable(tenantId, r.id, ''))}>
                            Baixar
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        {canManage ? (
          <Panel title="Novo recebível">
            <form
              className="fn-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!amount) return;
                void action.run(() => createReceivable(tenantId, form.customer, form.description, amount, form.due), {
                  onSuccess: () => setForm({ customer: '', description: '', amount: '', due: today }),
                });
              }}
            >
              <label className="fn-field">
                Cliente
                <input required minLength={2} value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} />
              </label>
              <label className="fn-field">
                Descrição
                <input required minLength={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <div className="fn-grid2">
                <label className="fn-field">
                  Valor
                  <input required inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </label>
                <label className="fn-field">
                  Vencimento
                  <input required type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
                </label>
              </div>
              <button type="submit" className="fn-btn fn-btn--primary" disabled={action.pending || !amount}>
                Registrar
              </button>
            </form>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
