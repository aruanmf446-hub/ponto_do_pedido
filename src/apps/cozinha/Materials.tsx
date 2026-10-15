'use client';

import { useState } from 'react';
import { formatDateTime } from '@/core/dates';
import { useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { requestMaterials } from '@/apps/cozinha/actions';

const STATUS: Record<string, string> = {
  requested: 'Solicitado',
  authorized: 'Autorizado',
  fulfilled: 'Entregue',
  purchase_requested: 'Em compra',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
};

/** A cozinha solicita materiais ao Estoque (o atendimento é feito no Estoque). */
export function MaterialsRequest({
  materials,
  sectors,
  requests,
}: {
  materials: { id: string; name: string; unit: string }[];
  sectors: { id: string; name: string }[];
  requests: { id: string; number: number; status: string; requested_at: string; items: { quantity: number; material: { name: string; unit: string } | null }[] }[];
}) {
  const { tenantId, timezone } = useTenant();
  const action = useAction();
  const [lines, setLines] = useState<{ material_id: string; quantity: string }[]>([{ material_id: materials[0]?.id ?? '', quantity: '1' }]);
  const [sector, setSector] = useState(sectors[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [ok, setOk] = useState<string | null>(null);

  return (
    <div className="kz-materials">
      <section className="kz-panel">
        <h1 className="kz-title">Solicitar material ao estoque</h1>
        {materials.length === 0 ? <p>Nenhum material cadastrado no estoque.</p> : null}
        {lines.map((l, i) => (
          <div key={i} className="kz-line">
            <select aria-label="Material" value={l.material_id} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, material_id: e.target.value } : x)))}>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
            <input aria-label="Quantidade" inputMode="decimal" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
            <button type="button" className="kz-link" onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1}>
              Remover
            </button>
          </div>
        ))}
        <button type="button" className="kz-btn" onClick={() => setLines([...lines, { material_id: materials[0]?.id ?? '', quantity: '1' }])}>
          Adicionar material
        </button>
        <label className="kz-field">
          Setor solicitante
          <select value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">—</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="kz-field">
          Observação
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {action.error ? <p className="kz-error">{action.error.message}</p> : null}
        {ok ? <p className="kz-ok">{ok}</p> : null}
        <button
          type="button"
          className="kz-btn kz-btn--go"
          disabled={action.pending || materials.length === 0}
          onClick={() =>
            void action.run(
              () =>
                requestMaterials(
                  tenantId,
                  sector || null,
                  lines.map((l) => ({ material_id: l.material_id, quantity: Number(l.quantity.replace(',', '.')) })).filter((l) => l.quantity > 0),
                  notes,
                ),
              { onSuccess: () => (setOk('Solicitação enviada ao estoque.'), setLines([{ material_id: materials[0]?.id ?? '', quantity: '1' }]), setNotes('')) },
            )
          }
        >
          Enviar solicitação
        </button>
      </section>
      <section className="kz-panel">
        <h2 className="kz-title">Solicitações recentes</h2>
        <ul className="kz-req">
          {requests.map((r) => (
            <li key={r.id}>
              <strong>Nº {r.number}</strong> · {STATUS[r.status] ?? r.status} · {formatDateTime(r.requested_at, timezone)}
              <br />
              <small>{r.items.map((i) => `${i.quantity} ${i.material?.unit ?? ''} ${i.material?.name ?? ''}`).join(', ')}</small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
