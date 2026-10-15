'use client';

import { useState } from 'react';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { saveSupplier } from '@/apps/financeiro/actions';
import type { Supplier } from '@/apps/financeiro/queries';
import { Badge, Empty, ExternalNotice, PageHead, Panel } from '@/apps/financeiro/ui';

const BLANK = { id: null as string | null, name: '', document: '', contact_name: '', phone: '', email: '', notes: '', active: true };

export function Suppliers({ suppliers, external }: { suppliers: Supplier[]; external: boolean }) {
  const { tenantId } = useTenant();
  const canManage = usePermission('financeiro.fornecedores.gerir') === 'direct' && !external;
  const action = useAction();
  const [form, setForm] = useState(BLANK);
  const [q, setQ] = useState('');
  const list = suppliers.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || (s.document ?? '').includes(q));

  return (
    <div className="fn-stack">
      <PageHead title="Fornecedores" subtitle={`${suppliers.filter((s) => s.active).length} ativos`} />
      {external ? <ExternalNotice label="O cadastro de fornecedores" /> : null}
      {action.error ? <p className="fn-error">{action.error.message}</p> : null}
      <div className="fn-split">
        <Panel title="Cadastro" actions={<input className="fn-search" type="search" placeholder="Buscar" aria-label="Buscar fornecedor" value={q} onChange={(e) => setQ(e.target.value)} />}>
          {list.length === 0 ? (
            <Empty>Nenhum fornecedor.</Empty>
          ) : (
            <ul className="fn-cards">
              {list.map((s) => (
                <li key={s.id} className="fn-card" data-inactive={!s.active}>
                  <header className="fn-card-head">
                    <strong>{s.name}</strong>
                    {s.active ? null : <Badge tone="danger">Inativo</Badge>}
                  </header>
                  <p className="fn-sub">{[s.document, s.contact_name, s.phone, s.email].filter(Boolean).join(' · ') || 'Sem contato registrado'}</p>
                  {canManage ? (
                    <button
                      type="button"
                      className="fn-link"
                      onClick={() =>
                        setForm({
                          id: s.id,
                          name: s.name,
                          document: s.document ?? '',
                          contact_name: s.contact_name ?? '',
                          phone: s.phone ?? '',
                          email: s.email ?? '',
                          notes: s.notes ?? '',
                          active: s.active,
                        })
                      }
                    >
                      Editar
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {canManage ? (
          <Panel title={form.id ? 'Editar fornecedor' : 'Novo fornecedor'}>
            <form
              className="fn-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(() => saveSupplier(tenantId, form), { onSuccess: () => setForm(BLANK) });
              }}
            >
              <label className="fn-field">
                Razão social / nome
                <input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <div className="fn-grid2">
                <label className="fn-field">
                  CNPJ/CPF
                  <input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
                </label>
                <label className="fn-field">
                  Contato
                  <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                </label>
                <label className="fn-field">
                  Telefone
                  <input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </label>
                <label className="fn-field">
                  E-mail
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
              </div>
              <label className="fn-field">
                Observações
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
              <label className="fn-check">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Ativo
              </label>
              <div className="fn-row">
                {form.id ? (
                  <button type="button" className="fn-btn fn-btn--ghost" onClick={() => setForm(BLANK)}>
                    Cancelar edição
                  </button>
                ) : null}
                <button type="submit" className="fn-btn fn-btn--primary" disabled={action.pending}>
                  Salvar
                </button>
              </div>
            </form>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
