'use client';

import { useMemo, useState } from 'react';
import { formatCents, parseCents } from '@/core/money';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { newIdempotencyKey, useAction } from '@/core/ui/useAction';
import { cancelPayable, createPayable, payPayable } from '@/apps/financeiro/actions';
import type { Payable, Supplier } from '@/apps/financeiro/queries';
import { Badge, Empty, ExternalNotice, PageHead, Panel, STATUS_LABEL, fmtDay, statusTone } from '@/apps/financeiro/ui';

const METHODS = ['PIX', 'Boleto', 'Transferência', 'Dinheiro', 'Cartão'];
const KINDS: Record<string, string> = { conta: 'Conta', despesa: 'Despesa', reembolso: 'Reembolso', compra: 'Compra' };

export function Payables({
  payables,
  suppliers,
  documents,
  external,
  today,
}: {
  payables: Payable[];
  suppliers: Supplier[];
  documents: { id: string; title: string; kind: string }[];
  external: boolean;
  today: string;
}) {
  const { tenantId } = useTenant();
  const canManage = usePermission('financeiro.pagar.gerir') === 'direct';
  const payMode = usePermission('financeiro.pagar.pagar');
  const action = useAction();
  const [filter, setFilter] = useState<'open' | 'paid' | 'all'>('open');
  const [paying, setPaying] = useState<Payable | null>(null);
  const [method, setMethod] = useState(METHODS[0] ?? 'PIX');
  const [proof, setProof] = useState('');
  const [form, setForm] = useState({ kind: 'conta', supplier_id: '', description: '', category: 'Geral', amount: '', due_date: today, document_id: '' });
  const [key, setKey] = useState(() => newIdempotencyKey('pay'));

  const list = useMemo(() => payables.filter((p) => filter === 'all' || (filter === 'open' ? p.status === 'open' : p.status === 'paid')), [payables, filter]);
  const openTotal = payables.filter((p) => p.status === 'open').reduce((a, p) => a + Number(p.amount_cents), 0);
  const amount = parseCents(form.amount);

  return (
    <div className="fn-stack">
      <PageHead title="Contas a pagar" subtitle={`Em aberto: ${formatCents(openTotal)}`} />
      {external ? <ExternalNotice label="Contas a pagar" /> : null}
      {action.error ? <p className="fn-error">{action.error.message}</p> : null}
      <div className="fn-split">
        <Panel
          title="Lançamentos"
          actions={
            <div className="fn-seg" role="group" aria-label="Filtro">
              {(['open', 'paid', 'all'] as const).map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f === 'open' ? 'Em aberto' : f === 'paid' ? 'Pagas' : 'Todas'}
                </button>
              ))}
            </div>
          }
        >
          {list.length === 0 ? (
            <Empty>Nenhuma conta neste filtro.</Empty>
          ) : (
            <div className="fn-table-wrap">
              <table className="fn-table">
                <thead>
                  <tr>
                    <th>Vencimento</th>
                    <th>Descrição</th>
                    <th>Situação</th>
                    <th className="fn-num">Valor</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} id={`p-${p.id}`} data-overdue={p.status === 'open' && p.due_date < today}>
                      <td>{fmtDay(p.due_date)}</td>
                      <td>
                        <strong>{p.description}</strong>
                        <br />
                        <small>
                          {KINDS[p.kind] ?? p.kind} · {p.category}
                          {p.supplier ? ` · ${p.supplier.name}` : ''}
                        </small>
                      </td>
                      <td>
                        <Badge tone={p.status === 'open' && p.due_date < today ? 'danger' : statusTone(p.status)}>
                          {p.status === 'open' && p.due_date < today ? 'Vencida' : (STATUS_LABEL[p.status] ?? p.status)}
                        </Badge>
                        {p.paid_method ? <small> {p.paid_method}</small> : null}
                      </td>
                      <td className="fn-num">{formatCents(p.amount_cents)}</td>
                      <td className="fn-actions">
                        {p.status === 'open' && !external && payMode !== 'deny' ? (
                          <button type="button" className="fn-btn fn-btn--primary" onClick={() => setPaying(p)}>
                            Pagar
                          </button>
                        ) : null}
                        {p.status === 'open' && !external && canManage ? (
                          <button
                            type="button"
                            className="fn-btn fn-btn--ghost"
                            disabled={action.pending}
                            onClick={() => {
                              const reason = window.prompt('Motivo do cancelamento');
                              if (reason && reason.trim().length >= 3) void action.run(() => cancelPayable(tenantId, p.id, reason.trim()));
                            }}
                          >
                            Cancelar
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

        {canManage && !external ? (
          <Panel title="Nova conta ou despesa">
            <form
              className="fn-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!amount || amount <= 0) return;
                void action.run(
                  () =>
                    createPayable(
                      tenantId,
                      {
                        kind: form.kind,
                        supplier_id: form.supplier_id || null,
                        description: form.description,
                        category: form.category,
                        amount_cents: amount,
                        due_date: form.due_date,
                        document_id: form.document_id || null,
                      },
                      key,
                    ),
                  {
                    onSuccess: () => {
                      setForm({ ...form, description: '', amount: '', document_id: '' });
                      setKey(newIdempotencyKey('pay'));
                    },
                  },
                );
              }}
            >
              <label className="fn-field">
                Tipo
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  <option value="conta">Conta</option>
                  <option value="despesa">Despesa</option>
                </select>
              </label>
              <label className="fn-field">
                Descrição
                <input required minLength={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <div className="fn-grid2">
                <label className="fn-field">
                  Valor
                  <input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </label>
                <label className="fn-field">
                  Vencimento
                  <input required type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </label>
              </div>
              <div className="fn-grid2">
                <label className="fn-field">
                  Categoria
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </label>
                <label className="fn-field">
                  Fornecedor
                  <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                    <option value="">—</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="fn-field">
                Documento (nota, contrato)
                <select value={form.document_id} onChange={(e) => setForm({ ...form, document_id: e.target.value })}>
                  <option value="">—</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="fn-btn fn-btn--primary" disabled={action.pending || !amount}>
                Registrar
              </button>
            </form>
          </Panel>
        ) : null}
      </div>

      {paying ? (
        <div className="fn-sheet" role="dialog" aria-label="Registrar pagamento">
          <h2 className="fn-h2">Pagar: {paying.description}</h2>
          <p className="fn-sub">
            {formatCents(paying.amount_cents)} · vence {fmtDay(paying.due_date)}
          </p>
          <label className="fn-field">
            Forma de pagamento
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="fn-field">
            Comprovante
            <select value={proof} onChange={(e) => setProof(e.target.value)}>
              <option value="">—</option>
              {documents
                .filter((d) => d.kind === 'comprovante')
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
            </select>
          </label>
          {payMode === 'approval' ? <p className="fn-sub">O pagamento acima do seu limite segue para aprovação.</p> : null}
          <div className="fn-row">
            <button type="button" className="fn-btn fn-btn--ghost" onClick={() => setPaying(null)}>
              Voltar
            </button>
            <button
              type="button"
              className="fn-btn fn-btn--primary"
              disabled={action.pending}
              onClick={() =>
                void action.run(() => payPayable(tenantId, paying.id, method, proof || null), {
                  onSuccess: () => setPaying(null),
                  approval: {
                    kind: 'payable.pay',
                    summary: `Pagar ${paying.description} (${formatCents(paying.amount_cents)}) via ${method}`,
                    amountCents: paying.amount_cents,
                    payload: { payable_id: paying.id, paid_method: method, proof_document: proof || '' },
                  },
                })
              }
            >
              Confirmar pagamento
            </button>
          </div>
        </div>
      ) : null}
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={() => (action.clearApproval(), setPaying(null))} />
    </div>
  );
}
