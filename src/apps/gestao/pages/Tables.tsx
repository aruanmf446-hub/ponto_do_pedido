'use client';

import { useState } from 'react';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { Dialog } from '@/core/ui/Dialog';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { deleteSector, deleteTable, rotateTableQr, saveSector, saveTable } from '@/apps/gestao/actions';
import { Badge, Empty, PageHead } from '@/apps/gestao/ui';

type Sector = { id: string; name: string; kind: string; active: boolean };
type Table = { id: string; label: string; sector_id: string | null; seats: number; active: boolean; qr_token: string; position: number; qr_svg: string; qr_url: string; occupied: boolean };

const KINDS: Record<string, string> = { salao: 'Salão', producao: 'Produção', estoque: 'Estoque', administrativo: 'Administrativo', outro: 'Outro' };

export function TablesPage({ sectors, tables }: { sectors: Sector[]; tables: Table[] }) {
  const { tenantId } = useTenant();
  const action = useAction();
  const canCreate = usePermission('cadastros.mesas.cadastrar') !== 'deny';
  const canQr = usePermission('cardapio.configurar') !== 'deny';
  const [editing, setEditing] = useState<Table | 'new' | null>(null);
  const [sectorEdit, setSectorEdit] = useState<Sector | 'new' | null>(null);
  const [qr, setQr] = useState<Table | null>(null);
  const sectorName = new Map(sectors.map((s) => [s.id, s.name]));

  return (
    <>
      <PageHead
        title="Mesas e setores"
        subtitle="Registro oficial usado por Atendimento, Caixa e Cardápio. Cada mesa tem QR Code próprio."
        actions={
          <>
            <button type="button" className="gs-btn" onClick={() => setSectorEdit('new')}>
              Novo setor
            </button>
            {canCreate ? (
              <button type="button" className="gs-btn gs-btn--primary" onClick={() => setEditing('new')}>
                Nova mesa
              </button>
            ) : null}
          </>
        }
      />
      {action.error ? <p className="gs-msg gs-msg--error">{action.error.message}</p> : null}
      <section className="gs-card" aria-labelledby="setores" style={{ marginBottom: 16 }}>
        <h2 id="setores" className="gs-h2">
          Setores
        </h2>
        {sectors.length === 0 ? <p className="gs-meta">Nenhum setor. Crie ao menos o salão.</p> : null}
        <div className="gs-row">
          {sectors.map((s) => (
            <button key={s.id} type="button" className="gs-btn gs-btn--small" onClick={() => setSectorEdit(s)}>
              {s.name} · {KINDS[s.kind] ?? s.kind}
              {!s.active ? ' (inativo)' : ''}
            </button>
          ))}
        </div>
      </section>
      {tables.length === 0 ? <Empty>Nenhuma mesa cadastrada.</Empty> : null}
      <div className="gs-tables-grid">
        {tables.map((t) => (
          <article key={t.id} className="gs-card">
            <div className="gs-cardhead">
              <h2 className="gs-h2">Mesa {t.label}</h2>
              {t.occupied ? <Badge tone="warn">Ocupada</Badge> : t.active ? <Badge tone="ok">Livre</Badge> : <Badge>Inativa</Badge>}
            </div>
            <p className="gs-meta" style={{ margin: 0 }}>
              {t.sector_id ? sectorName.get(t.sector_id) : 'Sem setor'} · {t.seats} lugares
            </p>
            <div className="gs-row">
              <button type="button" className="gs-btn gs-btn--small" onClick={() => setEditing(t)}>
                Editar
              </button>
              <button type="button" className="gs-btn gs-btn--small" onClick={() => setQr(t)}>
                QR Code
              </button>
            </div>
          </article>
        ))}
      </div>

      {editing ? (
        <TableEditor table={editing === 'new' ? null : editing} sectors={sectors} onClose={() => setEditing(null)} nextPosition={tables.length} />
      ) : null}
      {sectorEdit ? <SectorEditor sector={sectorEdit === 'new' ? null : sectorEdit} onClose={() => setSectorEdit(null)} /> : null}
      {qr ? (
        <Dialog open onClose={() => setQr(null)} title={`QR Code — Mesa ${qr.label}`}>
          <div className="gs-form" style={{ justifyItems: 'center', textAlign: 'center' }}>
            <div className="gs-qr" dangerouslySetInnerHTML={{ __html: qr.qr_svg }} style={{ width: 220, height: 220 }} />
            <p className="gs-meta" style={{ overflowWrap: 'anywhere' }}>
              {qr.qr_url}
            </p>
            <p className="gs-meta">O QR identifica a mesa automaticamente. Gerar um novo invalida o anterior.</p>
            <div className="gs-row">
              <button type="button" className="gs-btn" onClick={() => window.print()}>
                Imprimir
              </button>
              {canQr ? (
                <button
                  type="button"
                  className="gs-btn gs-btn--danger"
                  disabled={action.pending}
                  onClick={() =>
                    void action.run(() => rotateTableQr(tenantId, qr.id), {
                      onSuccess: () => setQr(null),
                      approval: { kind: 'table.rotate_qr', summary: `Gerar novo QR Code da mesa ${qr.label}`, payload: { id: qr.id } },
                    })
                  }
                >
                  Gerar novo QR Code
                </button>
              ) : null}
            </div>
          </div>
        </Dialog>
      ) : null}
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </>
  );
}

function TableEditor({ table, sectors, onClose, nextPosition }: { table: Table | null; sectors: Sector[]; onClose: () => void; nextPosition: number }) {
  const { tenantId } = useTenant();
  const action = useAction();
  return (
    <Dialog open onClose={onClose} title={table ? `Mesa ${table.label}` : 'Nova mesa'}>
      <form
        className="gs-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const input = {
            id: table?.id ?? null,
            label: String(f.get('label')),
            sector: String(f.get('sector')) || null,
            seats: Number(f.get('seats')),
            active: f.get('active') === 'on',
            position: table?.position ?? nextPosition,
          };
          void action.run(() => saveTable(tenantId, input), {
            onSuccess: onClose,
            approval: { kind: 'table.save', summary: `Salvar mesa ${input.label}`, payload: { ...input, id: input.id ?? '', sector: input.sector ?? '' } },
          });
        }}
      >
        <div className="gs-form-grid">
          <label className="gs-field">
            Identificação
            <input name="label" defaultValue={table?.label ?? ''} required maxLength={20} />
          </label>
          <label className="gs-field">
            Setor
            <select name="sector" defaultValue={table?.sector_id ?? sectors[0]?.id ?? ''}>
              <option value="">Sem setor</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="gs-field">
            Lugares
            <input name="seats" type="number" min={1} max={99} defaultValue={table?.seats ?? 4} />
          </label>
        </div>
        <label className="gs-check">
          <input type="checkbox" name="active" defaultChecked={table?.active ?? true} /> Ativa
        </label>
        {action.error ? <p className="gs-msg gs-msg--error">{action.error.message}</p> : null}
        <div className="gs-row">
          <button type="submit" className="gs-btn gs-btn--primary" disabled={action.pending}>
            Salvar
          </button>
          {table ? (
            <button
              type="button"
              className="gs-btn gs-btn--danger"
              disabled={action.pending}
              onClick={() =>
                void action.run(() => deleteTable(tenantId, table.id), {
                  onSuccess: onClose,
                  approval: { kind: 'table.delete', summary: `Excluir mesa ${table.label}`, payload: { id: table.id } },
                })
              }
            >
              Excluir
            </button>
          ) : null}
        </div>
      </form>
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </Dialog>
  );
}

function SectorEditor({ sector, onClose }: { sector: Sector | null; onClose: () => void }) {
  const { tenantId } = useTenant();
  const action = useAction();
  return (
    <Dialog open onClose={onClose} title={sector ? `Setor ${sector.name}` : 'Novo setor'}>
      <form
        className="gs-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const input = { id: sector?.id ?? null, name: String(f.get('name')), kind: String(f.get('kind')), active: f.get('active') === 'on' };
          void action.run(() => saveSector(tenantId, input), {
            onSuccess: onClose,
            approval: { kind: 'sector.save', summary: `Salvar setor ${input.name}`, payload: { ...input, id: input.id ?? '' } },
          });
        }}
      >
        <label className="gs-field">
          Nome
          <input name="name" defaultValue={sector?.name ?? ''} required />
        </label>
        <label className="gs-field">
          Tipo
          <select name="kind" defaultValue={sector?.kind ?? 'salao'}>
            {Object.entries(KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="gs-check">
          <input type="checkbox" name="active" defaultChecked={sector?.active ?? true} /> Ativo
        </label>
        {action.error ? <p className="gs-msg gs-msg--error">{action.error.message}</p> : null}
        <div className="gs-row">
          <button type="submit" className="gs-btn gs-btn--primary" disabled={action.pending}>
            Salvar
          </button>
          {sector ? (
            <button
              type="button"
              className="gs-btn gs-btn--danger"
              onClick={() =>
                void action.run(() => deleteSector(tenantId, sector.id), {
                  onSuccess: onClose,
                  approval: { kind: 'sector.delete', summary: `Excluir setor ${sector.name}`, payload: { id: sector.id } },
                })
              }
            >
              Excluir
            </button>
          ) : null}
        </div>
      </form>
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </Dialog>
  );
}
