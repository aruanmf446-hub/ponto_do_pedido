'use client';

import { useState } from 'react';
import { formatCents, parseCents } from '@/core/money';
import { browserSupabase } from '@/core/supabase/browser';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { saveDocument } from '@/apps/financeiro/actions';
import type { DocumentRow, Supplier } from '@/apps/financeiro/queries';
import { Badge, DOC_KINDS, Empty, ExternalNotice, PageHead, Panel, fmtDay } from '@/apps/financeiro/ui';

/** Contratos, notas e comprovantes no bucket privado do restaurante. */
export function Documents({ documents, suppliers, external, today }: { documents: DocumentRow[]; suppliers: Supplier[]; external: boolean; today: string }) {
  const { tenantId } = useTenant();
  const manageMode = usePermission('financeiro.documentos.gerir');
  const payMode = usePermission('financeiro.pagar.gerir');
  const canAdd = !external && (manageMode === 'direct' || payMode === 'direct');
  const action = useAction();
  const [kind, setKind] = useState<string>('all');
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ kind: 'nota_fiscal', title: '', supplier_id: '', amount: '', issued_on: today, valid_until: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const list = documents.filter((d) => kind === 'all' || d.kind === kind);

  const open = async (path: string) => {
    const { data, error } = await browserSupabase().storage.from('tenant-documents').createSignedUrl(path, 120);
    if (error || !data) setUploadError('Não foi possível abrir o arquivo.');
    else window.open(data.signedUrl, '_blank', 'noopener');
  };

  const submit = async () => {
    setUploadError(null);
    let path: string | null = null;
    if (file) {
      setBusy(true);
      const safe = file.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);
      path = `${tenantId}/documentos/${crypto.randomUUID()}-${safe}`;
      const { error } = await browserSupabase().storage.from('tenant-documents').upload(path, file, { contentType: file.type });
      setBusy(false);
      if (error) {
        setUploadError('Falha no envio do arquivo. Use PDF, imagem ou XML de até 15 MB.');
        return;
      }
    }
    await action.run(
      () =>
        saveDocument(tenantId, {
          kind: form.kind,
          title: form.title,
          storage_path: path,
          supplier_id: form.supplier_id || null,
          amount_cents: parseCents(form.amount),
          issued_on: form.issued_on || null,
          valid_until: form.valid_until || null,
          notes: form.notes,
        }),
      { onSuccess: () => (setForm({ ...form, title: '', amount: '', notes: '', valid_until: '' }), setFile(null)) },
    );
  };

  return (
    <div className="fn-stack">
      <PageHead title="Documentos" subtitle="Contratos, notas fiscais, comprovantes e orçamentos." />
      {external ? <ExternalNotice label="A gestão de documentos" /> : null}
      {action.error ? <p className="fn-error">{action.error.message}</p> : null}
      {uploadError ? <p className="fn-error">{uploadError}</p> : null}
      <div className="fn-split">
        <Panel
          title="Arquivo"
          actions={
            <select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="all">Todos</option>
              {Object.entries(DOC_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          }
        >
          {list.length === 0 ? (
            <Empty>Nenhum documento.</Empty>
          ) : (
            <ul className="fn-docs">
              {list.map((d) => (
                <li key={d.id} className="fn-doc" data-expired={!!d.valid_until && d.valid_until < today}>
                  <span className="fn-doc-icon" aria-hidden="true">
                    {(DOC_KINDS[d.kind] ?? '?').slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <strong>{d.title}</strong>
                    <p className="fn-sub">
                      {[d.supplier?.name, d.issued_on ? `emitido ${fmtDay(d.issued_on)}` : null, d.valid_until ? `válido até ${fmtDay(d.valid_until)}` : null, d.amount_cents != null ? formatCents(d.amount_cents) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <Badge>{DOC_KINDS[d.kind] ?? d.kind}</Badge>
                  {d.storage_path ? (
                    <button type="button" className="fn-link" onClick={() => void open(d.storage_path!)}>
                      Abrir
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {canAdd ? (
          <Panel title="Arquivar documento">
            <form
              className="fn-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label className="fn-field">
                Tipo
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {Object.entries(DOC_KINDS).map(([k, v]) => (
                    <option key={k} value={k} disabled={manageMode !== 'direct' && k !== 'comprovante'}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fn-field">
                Título
                <input required minLength={2} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
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
              <div className="fn-grid2">
                <label className="fn-field">
                  Valor
                  <input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </label>
                <label className="fn-field">
                  Emissão
                  <input type="date" value={form.issued_on} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} />
                </label>
                <label className="fn-field">
                  Validade
                  <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
                </label>
              </div>
              <label className="fn-field">
                Arquivo (PDF, imagem ou XML)
                <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp,application/xml,text/xml" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              <label className="fn-field">
                Observações
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
              <button type="submit" className="fn-btn fn-btn--primary" disabled={action.pending || busy}>
                {busy ? 'Enviando…' : 'Arquivar'}
              </button>
            </form>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
