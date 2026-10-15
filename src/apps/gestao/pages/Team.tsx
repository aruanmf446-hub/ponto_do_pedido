'use client';

import { useMemo, useState } from 'react';
import { APP_LABELS, INTERNAL_APPS } from '@/core/apps';
import { formatDate } from '@/core/dates';
import { formatCents, parseCents } from '@/core/money';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { Dialog } from '@/core/ui/Dialog';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { createMember, grantPermission, revokePermission, setMemberRoles, updateMember } from '@/apps/gestao/actions';
import type { Grant, Member, Permission, Role } from '@/apps/gestao/queries';
import { Badge, MODULE_LABEL, PageHead } from '@/apps/gestao/ui';

const STATUS = { active: ['Ativo', 'ok'], suspended: ['Suspenso', 'warn'], revoked: ['Desligado', 'danger'] } as const;

export function TeamPage({
  members,
  roles,
  memberRoles,
  grants,
  permissions,
  rootUrl,
}: {
  members: Member[];
  roles: Role[];
  memberRoles: { membership_id: string; role_id: string }[];
  grants: Grant[];
  permissions: Permission[];
  rootUrl: string;
}) {
  const { tenantId, userId } = useTenant();
  const canCreate = usePermission('gestao.equipe.cadastrar') === 'direct';
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const rolesByMember = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const mr of memberRoles) map.set(mr.membership_id, [...(map.get(mr.membership_id) ?? []), mr.role_id]);
    return map;
  }, [memberRoles]);
  const roleName = new Map(roles.map((r) => [r.id, r.name]));

  return (
    <>
      <PageHead
        title="Equipe"
        subtitle={`Colaboradores, gestores e responsáveis. Cada pessoa entra por ${rootUrl}.`}
        actions={
          canCreate ? (
            <button type="button" className="gs-btn gs-btn--primary" onClick={() => setAdding(true)}>
              Cadastrar colaborador
            </button>
          ) : null
        }
      />
      <div className="gs-table-wrap">
        <table className="gs-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Cargo</th>
              <th>Área principal</th>
              <th>Funções</th>
              <th>Situação</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.display_name}</strong>
                  {m.is_owner ? (
                    <>
                      {' '}
                      <Badge tone="accent">Titular</Badge>
                    </>
                  ) : null}
                </td>
                <td>{m.job_title ?? '—'}</td>
                <td>{m.primary_app ? (MODULE_LABEL[m.primary_app] ?? m.primary_app) : '—'}</td>
                <td>{m.is_owner ? 'Todas' : (rolesByMember.get(m.id) ?? []).map((r) => roleName.get(r)).join(', ') || '—'}</td>
                <td>
                  <Badge tone={STATUS[m.status][1]}>{STATUS[m.status][0]}</Badge>
                </td>
                <td>
                  {!m.is_owner && m.user_id !== userId ? (
                    <button type="button" className="gs-btn gs-btn--small" onClick={() => setEditing(m)}>
                      Editar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding ? <AddMember roles={roles} onClose={() => setAdding(false)} tenantId={tenantId} /> : null}
      {editing ? (
        <EditMember
          key={editing.id}
          member={editing}
          members={members}
          roles={roles}
          currentRoles={rolesByMember.get(editing.id) ?? []}
          grants={grants.filter((g) => g.membership_id === editing.id)}
          permissions={permissions}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function AddMember({ roles, onClose, tenantId }: { roles: Role[]; onClose: () => void; tenantId: string }) {
  const action = useAction();
  const [done, setDone] = useState<string | null>(null);
  return (
    <Dialog open onClose={onClose} title="Cadastrar colaborador">
      {done ? (
        <div className="gs-form">
          <p className="gs-msg gs-msg--ok">{done}</p>
          <button type="button" className="gs-btn gs-btn--primary" onClick={onClose}>
            Concluir
          </button>
        </div>
      ) : (
        <form
          className="gs-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void action.run(
              () =>
                createMember(tenantId, {
                  email: String(f.get('email')),
                  full_name: String(f.get('full_name')),
                  job_title: String(f.get('job_title')),
                  primary_app: String(f.get('primary_app')),
                  role_ids: f.getAll('roles').map(String),
                  temporary_password: String(f.get('temporary_password')),
                }),
              {
                onSuccess: (r) =>
                  setDone(
                    r.created_account
                      ? 'Acesso criado. Informe a senha temporária ao colaborador: ele definirá uma senha pessoal no primeiro login.'
                      : 'Este e-mail já tinha conta no Ponto do Pedido: o colaborador foi vinculado e usa a senha que já possui.',
                  ),
              },
            );
          }}
        >
          <div className="gs-form-grid">
            <label className="gs-field">
              Nome
              <input name="full_name" required />
            </label>
            <label className="gs-field">
              E-mail
              <input name="email" type="email" required />
            </label>
            <label className="gs-field">
              Cargo
              <input name="job_title" placeholder="Ex.: Garçom" />
            </label>
            <label className="gs-field">
              Área principal
              <select name="primary_app" defaultValue="atendimento">
                {INTERNAL_APPS.map((a) => (
                  <option key={a} value={a}>
                    {APP_LABELS[a]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="gs-form" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="gs-h2" style={{ marginBottom: 8 }}>
              Funções
            </legend>
            {roles.map((r) => (
              <label key={r.id} className="gs-check">
                <input type="checkbox" name="roles" value={r.id} /> {r.name}
                <span className="gs-meta">— {r.description}</span>
              </label>
            ))}
          </fieldset>
          <label className="gs-field">
            Senha temporária
            <input name="temporary_password" type="text" minLength={8} autoComplete="off" />
            <small>Usada somente se o e-mail ainda não tiver conta. O colaborador troca no primeiro acesso.</small>
          </label>
          {action.error ? <p className="gs-msg gs-msg--error">{action.error.message}</p> : null}
          <button type="submit" className="gs-btn gs-btn--primary" disabled={action.pending}>
            {action.pending ? 'Cadastrando…' : 'Cadastrar'}
          </button>
        </form>
      )}
    </Dialog>
  );
}

function EditMember({
  member,
  members,
  roles,
  currentRoles,
  grants,
  permissions,
  onClose,
}: {
  member: Member;
  members: Member[];
  roles: Role[];
  currentRoles: string[];
  grants: Grant[];
  permissions: Permission[];
  onClose: () => void;
}) {
  const { tenantId, isOwner } = useTenant();
  const info = useAction();
  const roleAction = useAction();
  const grantAction = useAction();
  const [selected, setSelected] = useState<string[]>(currentRoles);
  const [lastGrant, setLastGrant] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const permLabel = new Map(permissions.map((p) => [p.code, p]));
  const modules = [...new Set(permissions.map((p) => p.module))];

  return (
    <Dialog open onClose={onClose} title={member.display_name}>
      <div className="gs-form">
        <form
          className="gs-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const input = {
              id: member.id,
              display_name: String(f.get('display_name')),
              job_title: String(f.get('job_title')),
              primary_app: String(f.get('primary_app')) || null,
              supervisor: String(f.get('supervisor')) || null,
              status: String(f.get('status')),
            };
            void info.run(() => updateMember(tenantId, input), {
              onSuccess: () => setMsg('Dados atualizados.'),
              approval: {
                kind: 'member.update',
                summary: `Alterar cadastro de ${member.display_name}`,
                payload: { membership_id: member.id, ...input },
              },
            });
          }}
        >
          <div className="gs-form-grid">
            <label className="gs-field">
              Nome de exibição
              <input name="display_name" defaultValue={member.display_name} />
            </label>
            <label className="gs-field">
              Cargo
              <input name="job_title" defaultValue={member.job_title ?? ''} />
            </label>
            <label className="gs-field">
              Área principal
              <select name="primary_app" defaultValue={member.primary_app ?? ''}>
                {INTERNAL_APPS.map((a) => (
                  <option key={a} value={a}>
                    {APP_LABELS[a]}
                  </option>
                ))}
              </select>
            </label>
            <label className="gs-field">
              Supervisor
              <select name="supervisor" defaultValue={member.supervisor_membership_id ?? ''}>
                <option value="">Nenhum</option>
                {members
                  .filter((m) => m.id !== member.id && m.status === 'active')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="gs-field">
              Situação
              <select name="status" defaultValue={member.status}>
                <option value="active">Ativo</option>
                <option value="suspended">Suspenso (bloqueia o acesso)</option>
                <option value="revoked">Desligado</option>
              </select>
            </label>
          </div>
          {info.error ? <p className="gs-msg gs-msg--error">{info.error.message}</p> : null}
          {msg ? <p className="gs-msg gs-msg--ok">{msg}</p> : null}
          <button type="submit" className="gs-btn gs-btn--primary" disabled={info.pending}>
            Salvar dados
          </button>
        </form>

        <section className="gs-form" aria-labelledby="em-roles">
          <h3 id="em-roles" className="gs-h2">
            Funções
          </h3>
          {roles.map((r) => (
            <label key={r.id} className="gs-check">
              <input
                type="checkbox"
                checked={selected.includes(r.id)}
                onChange={(e) => setSelected(e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id))}
              />
              {r.name}
            </label>
          ))}
          {roleAction.error ? (
            <div className="gs-row">
              <p className="gs-msg gs-msg--error">{roleAction.error.message}</p>
              {roleAction.error.code === 'DELEGATION_DENIED' && !isOwner ? (
                <button
                  type="button"
                  className="gs-btn gs-btn--small"
                  onClick={() =>
                    roleAction.openApproval(
                      { kind: 'member.roles', summary: `Atribuir funções a ${member.display_name}`, payload: { membership_id: member.id, role_ids: selected } },
                      'gestao.permissoes.delegar',
                    )
                  }
                >
                  Solicitar autorização ao titular
                </button>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className="gs-btn"
            disabled={roleAction.pending}
            onClick={() =>
              void roleAction.run(() => setMemberRoles(tenantId, member.id, selected), {
                onSuccess: () => setMsg('Funções atualizadas.'),
                approval: { kind: 'member.roles', summary: `Atribuir funções a ${member.display_name}`, payload: { membership_id: member.id, role_ids: selected } },
              })
            }
          >
            Salvar funções
          </button>
        </section>

        <section className="gs-form" aria-labelledby="em-grants">
          <h3 id="em-grants" className="gs-h2">
            Permissões individuais e delegações
          </h3>
          {grants.length === 0 ? <p className="gs-meta">Nenhuma permissão individual.</p> : null}
          <ul className="gs-list">
            {grants.map((g) => (
              <li key={g.id}>
                <span>
                  {permLabel.get(g.permission_code)?.label ?? g.permission_code}{' '}
                  <Badge tone={g.mode === 'deny' ? 'danger' : g.mode === 'approval' ? 'warn' : 'ok'}>
                    {g.mode === 'deny' ? 'Negada' : g.mode === 'approval' ? 'Com aprovação' : 'Direta'}
                  </Badge>
                  <span className="gs-meta">
                    {g.limit_cents != null ? ` · limite ${formatCents(g.limit_cents)}` : ''}
                    {g.can_delegate ? ' · pode delegar' : ''}
                    {g.expires_at ? ` · até ${formatDate(g.expires_at)}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  className="gs-btn gs-btn--small gs-btn--danger"
                  onClick={() => void grantAction.run(() => revokePermission(tenantId, g.id))}
                >
                  Revogar
                </button>
              </li>
            ))}
          </ul>
          <form
            className="gs-form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const input = {
                membership_id: member.id,
                code: String(f.get('code')),
                mode: String(f.get('mode')) as 'direct' | 'approval' | 'deny',
                limit_cents: parseCents(String(f.get('limit') ?? '')),
                can_delegate: f.get('can_delegate') === 'on',
                expires_at: String(f.get('expires') ?? '') ? new Date(`${f.get('expires')}T23:59:59`).toISOString() : null,
              };
              setLastGrant(input);
              void grantAction.run(() => grantPermission(tenantId, input), {
                approval: { kind: 'permission.grant', summary: `Conceder permissão a ${member.display_name}`, payload: input },
              });
            }}
          >
            <label className="gs-field">
              Permissão
              <select name="code" required>
                {modules.map((mod) => (
                  <optgroup key={mod} label={MODULE_LABEL[mod] ?? mod}>
                    {permissions
                      .filter((p) => p.module === mod)
                      .map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="gs-field">
              Forma
              <select name="mode" defaultValue="direct">
                <option value="direct">Direta</option>
                <option value="approval">Somente com aprovação</option>
                <option value="deny">Negar</option>
              </select>
            </label>
            <label className="gs-field">
              Limite (R$)
              <input name="limit" inputMode="decimal" placeholder="Sem limite" />
            </label>
            <label className="gs-field">
              Válida até
              <input name="expires" type="date" />
            </label>
            {isOwner ? (
              <label className="gs-check">
                <input type="checkbox" name="can_delegate" /> Pode repassar a outros
              </label>
            ) : null}
            <button type="submit" className="gs-btn" disabled={grantAction.pending}>
              Conceder
            </button>
          </form>
          {grantAction.error ? (
            <div className="gs-row">
              <p className="gs-msg gs-msg--error">{grantAction.error.message}</p>
              {grantAction.error.code === 'DELEGATION_DENIED' && !isOwner && lastGrant ? (
                <button
                  type="button"
                  className="gs-btn gs-btn--small"
                  onClick={() =>
                    grantAction.openApproval(
                      { kind: 'permission.grant', summary: `Conceder permissão a ${member.display_name}`, payload: lastGrant },
                      'gestao.permissoes.delegar',
                    )
                  }
                >
                  Solicitar autorização ao titular
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
      <ApprovalDialog tenantId={tenantId} approval={info.approval} onClose={info.clearApproval} />
      <ApprovalDialog tenantId={tenantId} approval={roleAction.approval} onClose={roleAction.clearApproval} />
      <ApprovalDialog tenantId={tenantId} approval={grantAction.approval} onClose={grantAction.clearApproval} />
    </Dialog>
  );
}
