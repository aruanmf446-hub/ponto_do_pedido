'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatCents, parseCents } from '@/core/money';
import { useHref, usePermission, useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { manualEntry, reconcile } from '@/apps/financeiro/actions';
import type { FlowDay } from '@/apps/financeiro/queries';
import { Badge, Empty, ExternalNotice, PageHead, Panel, fmtDay } from '@/apps/financeiro/ui';

type Entry = { id: string; direction: 'in' | 'out'; amount_cents: number; occurred_on: string; description: string; source: string; reconciled: boolean; bank_reference: string | null };
const SOURCE: Record<string, string> = { payable: 'Conta paga', receivable: 'Recebível', manual: 'Manual', caixa: 'Caixa' };

/** Fluxo de caixa por período e conciliação bancária manual (sem integração). */
export function CashFlow({ from, to, flow, entries, external }: { from: string; to: string; flow: FlowDay[]; entries: Entry[]; external: boolean }) {
  const { tenantId } = useTenant();
  const href = useHref();
  const router = useRouter();
  const canExec = usePermission('financeiro.conciliacao.executar') === 'direct';
  const action = useAction();
  const [form, setForm] = useState({ direction: 'out' as 'in' | 'out', amount: '', on: to, description: '' });
  const [refs, setRefs] = useState<Record<string, string>>({});
  const total = (k: keyof FlowDay) => flow.reduce((a, d) => a + Number(d[k]), 0);
  const max = Math.max(1, ...flow.map((d) => Math.max(Number(d.sales_cents) + Number(d.in_cents), Number(d.out_cents))));
  const go = (f: string, t: string) => router.push(href(`/financeiro/fluxo?de=${f}&ate=${t}`));

  return (
    <div className="fn-stack">
      <PageHead
        title="Fluxo de caixa e conciliação"
        subtitle="Vendas do Caixa por dia operacional e lançamentos financeiros."
        actions={
          <div className="fn-row">
            <input type="date" aria-label="De" value={from} onChange={(e) => e.target.value && go(e.target.value, to)} />
            <input type="date" aria-label="Até" value={to} onChange={(e) => e.target.value && go(from, e.target.value)} />
          </div>
        }
      />
      {external ? <ExternalNotice label="A conciliação" /> : null}
      {action.error ? <p className="fn-error">{action.error.message}</p> : null}
      <div className="fn-stats">
        <div className="fn-stat">
          <span className="fn-stat-label">Vendas</span>
          <span className="fn-stat-value">{formatCents(total('sales_cents'))}</span>
        </div>
        <div className="fn-stat">
          <span className="fn-stat-label">Outras entradas</span>
          <span className="fn-stat-value">{formatCents(total('in_cents'))}</span>
        </div>
        <div className="fn-stat">
          <span className="fn-stat-label">Saídas</span>
          <span className="fn-stat-value">{formatCents(total('out_cents'))}</span>
        </div>
        <div className="fn-stat" data-tone={total('net_cents') >= 0 ? 'ok' : 'danger'}>
          <span className="fn-stat-label">Resultado</span>
          <span className="fn-stat-value">{formatCents(total('net_cents'))}</span>
        </div>
        <div className="fn-stat" data-tone={total('scheduled_out_cents') ? 'warn' : undefined}>
          <span className="fn-stat-label">Contas a vencer no período</span>
          <span className="fn-stat-value">{formatCents(total('scheduled_out_cents'))}</span>
        </div>
      </div>
      <Panel title="Por dia">
        <div className="fn-flow" role="list">
          {flow.map((d) => (
            <div key={d.day} className="fn-flow-day" role="listitem" title={`${fmtDay(d.day)}: resultado ${formatCents(d.net_cents)}`}>
              <span className="fn-flow-in" style={{ height: `${((Number(d.sales_cents) + Number(d.in_cents)) / max) * 100}%` }} />
              <span className="fn-flow-out" style={{ height: `${(Number(d.out_cents) / max) * 100}%` }} />
              <small>{d.day.slice(8, 10)}</small>
            </div>
          ))}
        </div>
        <p className="fn-legend">
          <span className="fn-flow-in" /> Entradas <span className="fn-flow-out" /> Saídas
        </p>
      </Panel>
      <div className="fn-split">
        <Panel title="Lançamentos">
          {entries.length === 0 ? (
            <Empty>Nenhum lançamento no período.</Empty>
          ) : (
            <div className="fn-table-wrap">
              <table className="fn-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th className="fn-num">Valor</th>
                    <th>Conciliação</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td>{fmtDay(e.occurred_on)}</td>
                      <td>
                        {e.description}
                        <br />
                        <small>{SOURCE[e.source] ?? e.source}</small>
                      </td>
                      <td className="fn-num" data-negative={e.direction === 'out'}>
                        {e.direction === 'out' ? '−' : '+'} {formatCents(e.amount_cents)}
                      </td>
                      <td>
                        {e.reconciled ? (
                          <span className="fn-row">
                            <Badge tone="ok">Conciliado{e.bank_reference ? ` · ${e.bank_reference}` : ''}</Badge>
                            {canExec && !external ? (
                              <button type="button" className="fn-link" disabled={action.pending} onClick={() => void action.run(() => reconcile(tenantId, e.id, '', false))}>
                                Desfazer
                              </button>
                            ) : null}
                          </span>
                        ) : canExec && !external ? (
                          <span className="fn-row">
                            <input aria-label="Referência bancária" placeholder="Ref. extrato" value={refs[e.id] ?? ''} onChange={(ev) => setRefs({ ...refs, [e.id]: ev.target.value })} />
                            <button type="button" className="fn-btn" disabled={action.pending} onClick={() => void action.run(() => reconcile(tenantId, e.id, refs[e.id] ?? '', true))}>
                              Conciliar
                            </button>
                          </span>
                        ) : (
                          <Badge tone="warn">Pendente</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        {canExec ? (
          <Panel title="Lançamento manual">
            <form
              className="fn-form"
              onSubmit={(e) => {
                e.preventDefault();
                const amount = parseCents(form.amount);
                if (!amount) return;
                void action.run(() => manualEntry(tenantId, form.direction, amount, form.on, form.description), { onSuccess: () => setForm({ ...form, amount: '', description: '' }) });
              }}
            >
              <div className="fn-seg" role="group" aria-label="Direção">
                <button type="button" aria-pressed={form.direction === 'in'} onClick={() => setForm({ ...form, direction: 'in' })}>
                  Entrada
                </button>
                <button type="button" aria-pressed={form.direction === 'out'} onClick={() => setForm({ ...form, direction: 'out' })}>
                  Saída
                </button>
              </div>
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
                  Data
                  <input required type="date" value={form.on} onChange={(e) => setForm({ ...form, on: e.target.value })} />
                </label>
              </div>
              <button type="submit" className="fn-btn fn-btn--primary" disabled={action.pending}>
                Lançar
              </button>
            </form>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
