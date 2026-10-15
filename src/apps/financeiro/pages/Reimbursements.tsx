'use client';

import { useState } from 'react';
import { formatCents, parseCents } from '@/core/money';
import { browserSupabase } from '@/core/supabase/browser';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { decideReimbursement, requestReimbursement, saveDocument } from '@/apps/financeiro/actions';
import { Badge, Empty, ExternalNotice, PageHead, Panel, STATUS_LABEL, fmtDay, statusTone } from '@/apps/financeiro/ui';

type Row = { id: string; requested_by: string; description: string; category: string; amount_cents: number; spent_on: string; status: string; decision_note: string | null };

export function Reimbursements({ rows, names, external, today }: { rows: Row[]; names: Record<string, string>; external: boolean; today: string }) {
  const { tenantId, userId, isOwner } = useTenant();
  const canRequest = usePermission('financeiro.reembolsos.solicitar') === 'direct' && !external;
  const decideMode = usePermission('financeiro.reembolsos.aprovar');
  const action = useAction();
  const [form, setForm] = useState({ description: '', category: 'Geral', amount: '', spent_on: today });
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    const amount = parseCents(form.amount);
    if (!amount) return;
    let docId: string | null = null;
    if (file) {
      const path = `${tenantId}/reembolsos/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_').slice(-60)}`;
      const up = await browserSupabase().storage.from('tenant-documents').upload(path, file, { contentType: file.type });
      if (up.error) return setErr('Falha no envio do comprovante.');
      const saved = await saveDocument(tenantId, { kind: 'comprovante', title: `Comprovante — ${form.description}`, storage_path: path, supplier_id: null, amount_cents: amount, issued_on: form.spent_on, valid_until: null, notes: '' });
      if (!saved.ok) return setErr(saved.message);
      docId = saved.data;
    }
    await action.run(() => requestReimbursement(tenantId, form.description, form.category, amount, form.spent_on, docId), {
      onSuccess: () => (setForm({ ...form, description: '', amount: '' }), setFile(null)),
    });
  };

  const decide = (r: Row, approve: boolean) =>
    void action.run(() => decideReimbursement(tenantId, r.id, approve, ''), {
      approval: {
        kind: 'reimbursement.decide',
        summary: `${approve ? 'Aprovar' : 'Recusar'} reembolso de ${names[r.requested_by] ?? '—'}: ${r.description} (${formatCents(r.amount_cents)})`,
        amountCents: r.amount_cents,
        payload: { reimbursement_id: r.id, approve, note: '' },
      },
    });

  return (
    <div className="fn-stack">
      <PageHead title="Reembolsos" subtitle="Quem solicita não aprova o próprio reembolso." />
      {external ? <ExternalNotice label="Reembolsos" /> : null}
      {action.error ? <p className="fn-error">{action.error.message}</p> : null}
      {err ? <p className="fn-error">{err}</p> : null}
      <div className="fn-split">
        <Panel title="Solicitações">
          {rows.length === 0 ? (
            <Empty>Nenhum reembolso.</Empty>
          ) : (
            <ul className="fn-cards">
              {rows.map((r) => (
                <li key={r.id} className="fn-card">
                  <header className="fn-card-head">
                    <strong>{r.description}</strong>
                    <Badge tone={statusTone(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                  </header>
                  <p className="fn-sub">
                    {names[r.requested_by] ?? '—'} · {r.category} · gasto em {fmtDay(r.spent_on)} · <strong>{formatCents(r.amount_cents)}</strong>
                  </p>
                  {r.decision_note ? <p className="fn-sub">Decisão: {r.decision_note}</p> : null}
                  {r.status === 'requested' && decideMode !== 'deny' && !external && (r.requested_by !== userId || isOwner) ? (
                    <div className="fn-row">
                      <button type="button" className="fn-btn fn-btn--ghost" disabled={action.pending} onClick={() => decide(r, false)}>
                        Recusar
                      </button>
                      <button type="button" className="fn-btn fn-btn--primary" disabled={action.pending} onClick={() => decide(r, true)}>
                        Aprovar
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {canRequest ? (
          <Panel title="Pedir reembolso">
            <form
              className="fn-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label className="fn-field">
                O que foi pago
                <input required minLength={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <div className="fn-grid2">
                <label className="fn-field">
                  Valor
                  <input required inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </label>
                <label className="fn-field">
                  Data
                  <input required type="date" value={form.spent_on} onChange={(e) => setForm({ ...form, spent_on: e.target.value })} />
                </label>
              </div>
              <label className="fn-field">
                Categoria
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </label>
              <label className="fn-field">
                Comprovante
                <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              <button type="submit" className="fn-btn fn-btn--primary" disabled={action.pending}>
                Solicitar
              </button>
            </form>
          </Panel>
        ) : null}
      </div>
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </div>
  );
}
