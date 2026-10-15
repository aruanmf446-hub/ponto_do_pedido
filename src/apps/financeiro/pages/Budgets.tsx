'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatCents, parseCents } from '@/core/money';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { useHref, usePermission, useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { setBudget } from '@/apps/financeiro/actions';
import { Empty, ExternalNotice, PageHead, Panel } from '@/apps/financeiro/ui';

export function Budgets({ month, rows, external }: { month: string; rows: { category: string; limit_cents: number; spent_cents: number }[]; external: boolean }) {
  const { tenantId } = useTenant();
  const href = useHref();
  const router = useRouter();
  const mode = usePermission('financeiro.orcamentos.gerir');
  const canEdit = mode !== 'deny' && !external;
  const action = useAction();
  const [form, setForm] = useState({ category: '', limit: '' });
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}T12:00:00Z`));
  const save = (category: string, limit: number) =>
    void action.run(() => setBudget(tenantId, category, month, limit), {
      onSuccess: () => setForm({ category: '', limit: '' }),
      approval: { kind: 'budget.set', summary: `Orçamento ${category} em ${label}: ${formatCents(limit)}`, amountCents: limit, payload: { category, month, limit_cents: limit } },
    });

  return (
    <div className="fn-stack">
      <PageHead
        title="Orçamentos"
        subtitle={`Limites por categoria em ${label}, comparados às contas lançadas.`}
        actions={<input type="month" aria-label="Mês" value={month.slice(0, 7)} onChange={(e) => e.target.value && router.push(href(`/financeiro/orcamentos?mes=${e.target.value}`))} />}
      />
      {external ? <ExternalNotice label="Orçamentos" /> : null}
      {action.error ? <p className="fn-error">{action.error.message}</p> : null}
      <Panel>
        {rows.length === 0 ? (
          <Empty>Nenhum orçamento ou despesa neste mês.</Empty>
        ) : (
          <ul className="fn-budgets">
            {rows.map((r) => {
              const pct = r.limit_cents > 0 ? Math.round((r.spent_cents / r.limit_cents) * 100) : null;
              return (
                <li key={r.category} data-over={pct != null && pct > 100}>
                  <div className="fn-row fn-between">
                    <strong>{r.category}</strong>
                    <span>
                      {formatCents(r.spent_cents)} de {r.limit_cents ? formatCents(r.limit_cents) : 'sem limite'}
                      {pct != null ? ` · ${pct}%` : ''}
                    </span>
                  </div>
                  <span className="fn-meter" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      {canEdit ? (
        <Panel title="Definir limite">
          <form
            className="fn-form fn-form--inline"
            onSubmit={(e) => {
              e.preventDefault();
              const limit = parseCents(form.limit);
              if (limit == null || !form.category.trim()) return;
              save(form.category.trim(), limit);
            }}
          >
            <input aria-label="Categoria" placeholder="Categoria (ex.: Compras)" list="fn-cats" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <datalist id="fn-cats">
              {rows.map((r) => (
                <option key={r.category} value={r.category} />
              ))}
            </datalist>
            <input aria-label="Limite" inputMode="decimal" placeholder="Limite" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} />
            <button type="submit" className="fn-btn fn-btn--primary" disabled={action.pending}>
              {mode === 'approval' ? 'Pedir aprovação' : 'Salvar'}
            </button>
          </form>
        </Panel>
      ) : null}
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </div>
  );
}
