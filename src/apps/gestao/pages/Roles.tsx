'use client';

import { useState } from 'react';
import { formatCents, parseCents } from '@/core/money';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { Dialog } from '@/core/ui/Dialog';
import { useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { deleteRole, saveRole, type RolePermissionInput } from '@/apps/gestao/actions';
import type { Permission, Role } from '@/apps/gestao/queries';
import { MODULE_LABEL, PageHead } from '@/apps/gestao/ui';

type RolePerm = { role_id: string; permission_code: string; mode: 'direct' | 'approval'; limit_cents: number | null; can_delegate: boolean };

export function RolesPage({
  roles,
  rolePerms,
  permissions,
  usage,
  modules,
}: {
  roles: Role[];
  rolePerms: RolePerm[];
  permissions: Permission[];
  usage: Record<string, number>;
  modules: string[];
}) {
  const [editing, setEditing] = useState<Role | 'new' | null>(null);
  const visible = permissions.filter((p) => p.module === 'gestao' || modules.includes(p.module));
  return (
    <>
      <PageHead
        title="Funções e permissões"
        subtitle="Um cargo não precisa ter as mesmas permissões em todos os estabelecimentos. Ajuste ao seu restaurante."
        actions={
          <button type="button" className="gs-btn gs-btn--primary" onClick={() => setEditing('new')}>
            Nova função
          </button>
        }
      />
      <div className="gs-grid">
        {roles.map((role) => {
          const perms = rolePerms.filter((rp) => rp.role_id === role.id);
          return (
            <article key={role.id} className="gs-card">
              <div className="gs-cardhead">
                <h2 className="gs-h2">{role.name}</h2>
                <span className="gs-meta">{usage[role.id] ?? 0} pessoa(s)</span>
              </div>
              <p className="gs-meta" style={{ margin: 0 }}>
                {role.description || 'Sem descrição.'}
              </p>
              <p style={{ margin: 0 }}>
                {perms.filter((p) => p.mode === 'direct').length} permissões diretas · {perms.filter((p) => p.mode === 'approval').length} com
                aprovação
              </p>
              <button type="button" className="gs-btn gs-btn--small" onClick={() => setEditing(role)}>
                Editar
              </button>
            </article>
          );
        })}
      </div>
      {editing ? (
        <RoleEditor
          role={editing === 'new' ? null : editing}
          initial={editing === 'new' ? [] : rolePerms.filter((rp) => rp.role_id === editing.id)}
          permissions={visible}
          inUse={editing !== 'new' && (usage[editing.id] ?? 0) > 0}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function RoleEditor({
  role,
  initial,
  permissions,
  inUse,
  onClose,
}: {
  role: Role | null;
  initial: RolePerm[];
  permissions: Permission[];
  inUse: boolean;
  onClose: () => void;
}) {
  const { tenantId, isOwner } = useTenant();
  const action = useAction();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [state, setState] = useState<Record<string, { mode: '' | 'direct' | 'approval'; limit: string; delegate: boolean }>>(() =>
    Object.fromEntries(
      permissions.map((p) => {
        const rp = initial.find((i) => i.permission_code === p.code);
        return [p.code, { mode: rp?.mode ?? '', limit: rp?.limit_cents != null ? String(rp.limit_cents / 100) : '', delegate: rp?.can_delegate ?? false }];
      }),
    ),
  );
  const modules = [...new Set(permissions.map((p) => p.module))];

  const payload = (): RolePermissionInput[] =>
    Object.entries(state)
      .filter(([, v]) => v.mode)
      .map(([code, v]) => ({ code, mode: v.mode as 'direct' | 'approval', limit_cents: parseCents(v.limit), can_delegate: v.delegate }));

  return (
    <Dialog open onClose={onClose} title={role ? `Função: ${role.name}` : 'Nova função'} className="gs-wide-dialog">
      <div className="gs-form">
        <div className="gs-form-grid">
          <label className="gs-field">
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="gs-field">
            Descrição
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
        <p className="gs-meta" style={{ margin: 0 }}>
          “Direta” executa dentro do limite. “Com aprovação” encaminha ao responsável. Limites em reais valem para ações com valor.
        </p>
        {modules.map((mod) => (
          <div key={mod} className="gs-table-wrap">
            <table className="gs-table gs-matrix">
              <caption className="gs-h2" style={{ textAlign: 'left', padding: '10px 12px' }}>
                {MODULE_LABEL[mod] ?? mod}
              </caption>
              <tbody>
                {permissions
                  .filter((p) => p.module === mod)
                  .map((p) => {
                    const v = state[p.code]!;
                    return (
                      <tr key={p.code}>
                        <td>{p.label}</td>
                        <td>
                          <select
                            aria-label={`Forma para ${p.label}`}
                            value={v.mode}
                            onChange={(e) => setState({ ...state, [p.code]: { ...v, mode: e.target.value as typeof v.mode } })}
                          >
                            <option value="">Sem acesso</option>
                            <option value="direct">Direta</option>
                            {p.approvable ? <option value="approval">Com aprovação</option> : null}
                          </select>
                        </td>
                        <td>
                          {p.supports_limit && v.mode === 'direct' ? (
                            <input
                              className="gs-input"
                              style={{ width: 120, minHeight: 32 }}
                              inputMode="decimal"
                              aria-label={`Limite para ${p.label}`}
                              placeholder="Sem limite"
                              value={v.limit}
                              onChange={(e) => setState({ ...state, [p.code]: { ...v, limit: e.target.value } })}
                            />
                          ) : null}
                        </td>
                        <td>
                          {isOwner && v.mode === 'direct' ? (
                            <label className="gs-check">
                              <input
                                type="checkbox"
                                checked={v.delegate}
                                onChange={(e) => setState({ ...state, [p.code]: { ...v, delegate: e.target.checked } })}
                              />
                              Delegar
                            </label>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ))}
        {action.error ? <p className="gs-msg gs-msg--error">{action.error.message}</p> : null}
        <div className="gs-row">
          <button
            type="button"
            className="gs-btn gs-btn--primary"
            disabled={action.pending || name.trim().length < 2}
            onClick={() => {
              const perms = payload();
              void action.run(() => saveRole(tenantId, { id: role?.id ?? null, name, description, permissions: perms }), {
                onSuccess: onClose,
                approval: { kind: 'role.save', summary: `Salvar função ${name}`, payload: { id: role?.id ?? '', name, description, permissions: perms } },
              });
            }}
          >
            Salvar função
          </button>
          {role && !inUse ? (
            <button
              type="button"
              className="gs-btn gs-btn--danger"
              disabled={action.pending}
              onClick={() => void action.run(() => deleteRole(tenantId, role.id), { onSuccess: onClose })}
            >
              Excluir função
            </button>
          ) : null}
        </div>
        {initial.some((i) => i.limit_cents != null) ? (
          <p className="gs-meta">Limites atuais: {initial.filter((i) => i.limit_cents != null).map((i) => `${i.permission_code} ${formatCents(i.limit_cents)}`).join(', ')}</p>
        ) : null}
      </div>
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </Dialog>
  );
}
