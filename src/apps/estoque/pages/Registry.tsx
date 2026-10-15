'use client';

import { useState } from 'react';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { saveLocation, saveMaterial } from '@/apps/estoque/actions';
import type { Location, Material } from '@/apps/estoque/queries';
import { Badge, Empty, LOCATION_KINDS, PageHead, Panel, fmtQty } from '@/apps/estoque/ui';

const UNITS = ['un', 'kg', 'g', 'l', 'ml', 'cx', 'pct', 'm'];
const BLANK_M = { id: null as string | null, name: '', category: 'Geral', unit: 'un', sku: '', min_qty: '0', reorder_qty: '0', perishable: false, active: true };
const BLANK_L = { id: null as string | null, name: '', kind: 'deposito', active: true };

export function Registry({ materials, locations, external }: { materials: Material[]; locations: Location[]; external: boolean }) {
  const { tenantId } = useTenant();
  const canManage = usePermission('estoque.materiais.gerir') === 'direct';
  const action = useAction();
  const [m, setM] = useState(BLANK_M);
  const [l, setL] = useState(BLANK_L);
  const num = (v: string) => Number(v.replace(',', '.')) || 0;

  return (
    <div className="es-stack">
      <PageHead title="Materiais e locais" subtitle="Unidades, mínimos para alerta, perecíveis (validade obrigatória) e locais de armazenagem." />
      {action.error ? <p className="es-error">{action.error.message}</p> : null}
      <div className="es-split">
        <Panel title={`Materiais (${materials.length})`}>
          {materials.length === 0 ? <Empty>Nenhum material.</Empty> : null}
          <div className="es-table-wrap">
            <table className="es-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Unid.</th>
                  <th className="es-num">Mínimo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {materials.map((x) => (
                  <tr key={x.id} data-inactive={!x.active}>
                    <td>
                      <strong>{x.name}</strong> {x.perishable ? <Badge tone="warn">perecível</Badge> : null} {x.active ? null : <Badge tone="danger">inativo</Badge>}
                      <br />
                      <small>
                        {x.category}
                        {x.sku ? ` · ${x.sku}` : ''}
                      </small>
                    </td>
                    <td>{x.unit}</td>
                    <td className="es-num">{fmtQty(x.min_qty)}</td>
                    <td>
                      {canManage ? (
                        <button
                          type="button"
                          className="es-link"
                          onClick={() => setM({ ...x, sku: x.sku ?? '', min_qty: String(x.min_qty), reorder_qty: String(x.reorder_qty) })}
                        >
                          Editar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        {canManage ? (
          <Panel title={m.id ? 'Editar material' : 'Novo material'}>
            <form
              className="es-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(() => saveMaterial(tenantId, { ...m, min_qty: num(m.min_qty), reorder_qty: num(m.reorder_qty) }), {
                  onSuccess: () => setM(BLANK_M),
                });
              }}
            >
              <label className="es-field">
                Nome
                <input required value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />
              </label>
              <div className="es-grid2">
                <label className="es-field">
                  Categoria
                  <input value={m.category} onChange={(e) => setM({ ...m, category: e.target.value })} />
                </label>
                <label className="es-field">
                  Unidade
                  <select value={m.unit} onChange={(e) => setM({ ...m, unit: e.target.value })}>
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </label>
                <label className="es-field">
                  Estoque mínimo
                  <input inputMode="decimal" value={m.min_qty} onChange={(e) => setM({ ...m, min_qty: e.target.value })} />
                </label>
                <label className="es-field">
                  Repor (quantidade)
                  <input inputMode="decimal" value={m.reorder_qty} onChange={(e) => setM({ ...m, reorder_qty: e.target.value })} />
                </label>
                <label className="es-field">
                  Código (SKU)
                  <input value={m.sku} onChange={(e) => setM({ ...m, sku: e.target.value })} />
                </label>
              </div>
              <label className="es-check">
                <input type="checkbox" checked={m.perishable} onChange={(e) => setM({ ...m, perishable: e.target.checked })} /> Perecível (exige validade)
              </label>
              <label className="es-check">
                <input type="checkbox" checked={m.active} onChange={(e) => setM({ ...m, active: e.target.checked })} /> Ativo
              </label>
              <div className="es-row">
                {m.id ? (
                  <button type="button" className="es-btn es-btn--ghost" onClick={() => setM(BLANK_M)}>
                    Cancelar
                  </button>
                ) : null}
                <button type="submit" className="es-btn es-btn--primary" disabled={action.pending}>
                  Salvar material
                </button>
              </div>
            </form>
          </Panel>
        ) : null}
      </div>
      <div className="es-split">
        <Panel title={`Locais (${locations.length})`}>
          {locations.length === 0 ? <Empty>Nenhum local de armazenagem.</Empty> : null}
          <ul className="es-list">
            {locations.map((x) => (
              <li key={x.id} data-inactive={!x.active}>
                <span>
                  <strong>{x.name}</strong> · {LOCATION_KINDS[x.kind] ?? x.kind} {x.active ? null : <Badge tone="danger">inativo</Badge>}
                </span>
                {canManage && !external ? (
                  <button type="button" className="es-link" onClick={() => setL({ id: x.id, name: x.name, kind: x.kind, active: x.active })}>
                    Editar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
        {canManage && !external ? (
          <Panel title={l.id ? 'Editar local' : 'Novo local'}>
            <form
              className="es-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(() => saveLocation(tenantId, l), { onSuccess: () => setL(BLANK_L) });
              }}
            >
              <label className="es-field">
                Nome
                <input required value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} />
              </label>
              <label className="es-field">
                Tipo
                <select value={l.kind} onChange={(e) => setL({ ...l, kind: e.target.value })}>
                  {Object.entries(LOCATION_KINDS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="es-check">
                <input type="checkbox" checked={l.active} onChange={(e) => setL({ ...l, active: e.target.checked })} /> Ativo
              </label>
              <button type="submit" className="es-btn es-btn--primary" disabled={action.pending}>
                Salvar local
              </button>
            </form>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
