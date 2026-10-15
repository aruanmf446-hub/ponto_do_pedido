import Link from 'next/link';
import { formatDateTime } from '@/core/dates';
import type { Movement } from '@/apps/estoque/queries';
import { Empty, MOVE_LABEL, PageHead, Panel, fmtQty } from '@/apps/estoque/ui';

/** Rastreabilidade: toda alteração de saldo tem responsável, motivo e origem. */
export function Movements({ rows, names, kind, base, timezone }: { rows: Movement[]; names: Record<string, string>; kind: string | null; base: string; timezone: string }) {
  return (
    <div className="es-stack">
      <PageHead
        title="Movimentações"
        subtitle="Histórico rastreável de entradas, saídas, transferências, ajustes, perdas e descartes."
        actions={
          <nav className="es-seg" aria-label="Tipo">
            <Link href={`${base}/estoque/movimentos`} aria-current={!kind ? 'page' : undefined}>
              Todas
            </Link>
            {Object.entries(MOVE_LABEL).map(([k, v]) => (
              <Link key={k} href={`${base}/estoque/movimentos?tipo=${k}`} aria-current={kind === k ? 'page' : undefined}>
                {v}
              </Link>
            ))}
          </nav>
        }
      />
      <Panel>
        {rows.length === 0 ? (
          <Empty>Nenhuma movimentação.</Empty>
        ) : (
          <div className="es-table-wrap">
            <table className="es-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Tipo</th>
                  <th>Material</th>
                  <th className="es-num">Qtde.</th>
                  <th>De → para</th>
                  <th>Responsável / motivo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} data-kind={m.kind}>
                    <td>{formatDateTime(m.created_at, timezone)}</td>
                    <td>
                      <span className="es-kind" data-kind={m.kind}>
                        {MOVE_LABEL[m.kind] ?? m.kind}
                      </span>
                    </td>
                    <td>{m.material?.name}</td>
                    <td className="es-num" data-negative={Number(m.qty) < 0}>
                      {Number(m.qty) > 0 ? '+' : ''}
                      {fmtQty(m.qty, m.material?.unit)}
                    </td>
                    <td>
                      {m.from?.name ?? '—'} → {m.to?.name ?? '—'}
                    </td>
                    <td>
                      {names[m.created_by] ?? '—'}
                      {m.reason ? (
                        <>
                          <br />
                          <small>{m.reason}</small>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
