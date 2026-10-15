import Link from 'next/link';
import type { VisualModel } from '@/core/apps';
import { formatDateTime } from '@/core/dates';
import type { Lot, MaterialRequest, Movement, OverviewRow } from '@/apps/estoque/queries';
import { Badge, Empty, MOVE_LABEL, PageHead, Panel, REQ_LABEL, daysTo, expiryTone, fmtDay, fmtQty } from '@/apps/estoque/ui';

type Data = {
  rows: OverviewRow[];
  lots: Lot[];
  requests: MaterialRequest[];
  moves: Movement[];
  counts: { id: string; status: string; started_at: string; closed_at: string | null; location: { name: string } | null }[];
  names: Record<string, string>;
};

/** Saldos do estoque com composição própria para cada modelo. */
export function Overview({ data, model, base, today, timezone }: { data: Data; model: VisualModel; base: string; today: string; timezone: string }) {
  const { rows } = data;
  const gauge = (r: OverviewRow) => {
    const target = Math.max(Number(r.min_qty) * 2, Number(r.min_qty) + Number(r.reorder_qty), 1);
    return Math.min(100, (Number(r.available_qty) / target) * 100);
  };
  const status = (r: OverviewRow) => (Number(r.expired_qty) > 0 ? 'danger' : r.below_min ? 'danger' : Number(r.expiring_qty) > 0 ? 'warn' : 'ok');

  if (model === 'm1') {
    return (
      <div className="es-stack">
        <PageHead title="Saldos por material" subtitle={`${rows.length} materiais ativos · ${rows.filter((r) => r.below_min).length} abaixo do mínimo`} />
        <Panel>
          {rows.length === 0 ? (
            <Empty>Nenhum material cadastrado.</Empty>
          ) : (
            <div className="es-table-wrap">
              <table className="es-table">
                <thead>
                  <tr>
                    <th aria-label="Sinal" />
                    <th>Material</th>
                    <th>Nível</th>
                    <th className="es-num">Disponível</th>
                    <th className="es-num">Mínimo</th>
                    <th className="es-num">Bloqueado</th>
                    <th>Próx. validade</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.material_id}>
                      <td>
                        <span className="es-light" data-tone={status(r)} aria-label={status(r) === 'ok' ? 'normal' : 'atenção'} />
                      </td>
                      <td>
                        <strong>{r.name}</strong>
                        <br />
                        <small>{r.category}</small>
                      </td>
                      <td>
                        <span className="es-gauge" data-tone={status(r)}>
                          <span style={{ width: `${gauge(r)}%` }} />
                        </span>
                      </td>
                      <td className="es-num">{fmtQty(r.available_qty, r.unit)}</td>
                      <td className="es-num">{fmtQty(r.min_qty, r.unit)}</td>
                      <td className="es-num">{Number(r.blocked_qty) ? fmtQty(r.blocked_qty, r.unit) : '—'}</td>
                      <td>{fmtDay(r.next_expiry)}</td>
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

  if (model === 'm2') {
    const expired = data.lots.filter((l) => l.expires_on && l.expires_on < today);
    const soon = data.lots.filter((l) => l.expires_on && l.expires_on >= today && daysTo(l.expires_on, today) <= 7);
    const later = data.lots.filter((l) => l.expires_on && daysTo(l.expires_on, today) > 7);
    const lane = (title: string, tone: 'danger' | 'warn' | 'ok', list: Lot[]) => (
      <section className="es-lane" data-tone={tone}>
        <h2 className="es-h2">
          {title} <span>{list.length}</span>
        </h2>
        {list.length === 0 ? <Empty>Nenhum lote.</Empty> : null}
        <ul className="es-tapes">
          {list.map((l) => (
            <li key={l.id} className="es-tape" data-tone={tone} data-blocked={l.status === 'blocked'}>
              <strong>{l.material?.name}</strong>
              <span>
                {fmtQty(l.qty, l.material?.unit)} · {l.location?.name}
                {l.lot_code ? ` · lote ${l.lot_code}` : ''}
              </span>
              <span className="es-tape-date">
                {fmtDay(l.expires_on)}
                {l.expires_on ? ` (${daysTo(l.expires_on, today) < 0 ? `${-daysTo(l.expires_on, today)}d vencido` : `${daysTo(l.expires_on, today)}d`})` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
    return (
      <div className="es-stack">
        <PageHead title="Validade dos lotes" subtitle="Vence primeiro, sai primeiro. Vencidos e bloqueados não são liberados." actions={<Link className="es-btn" href={`${base}/estoque/lotes`}>Gerir lotes</Link>} />
        <div className="es-lanes">
          {lane('Vencidos', 'danger', expired)}
          {lane('Vencem em até 7 dias', 'warn', soon)}
          {lane('Em dia', 'ok', later)}
        </div>
      </div>
    );
  }

  if (model === 'm3') {
    const open = data.counts.find((c) => c.status === 'open');
    const last = data.counts.find((c) => c.status === 'closed');
    return (
      <div className="es-stack">
        <PageHead title="Prancheta do estoque" subtitle="Confira, conte e acerte as divergências." />
        <div className="es-clip">
          <Panel title="Conferência">
            {open ? (
              <p>
                Há uma conferência aberta {open.location ? `em ${open.location.name}` : 'geral'} desde {formatDateTime(open.started_at, timezone)}.{' '}
                <Link href={`${base}/estoque/inventario`}>Continuar contagem</Link>
              </p>
            ) : (
              <p>
                {last ? `Última conferência fechada em ${formatDateTime(last.closed_at, timezone)}.` : 'Nenhuma conferência realizada.'}{' '}
                <Link href={`${base}/estoque/inventario`}>Iniciar conferência</Link>
              </p>
            )}
          </Panel>
          <Panel title="Checklist de saldos">
            <ul className="es-checklist">
              {rows.map((r) => (
                <li key={r.material_id} data-tone={status(r)}>
                  <span className="es-checkbox" aria-hidden="true">
                    {status(r) === 'ok' ? '✓' : '!'}
                  </span>
                  <span>{r.name}</span>
                  <strong>{fmtQty(r.available_qty, r.unit)}</strong>
                </li>
              ))}
            </ul>
            {rows.length === 0 ? <Empty>Nenhum material cadastrado.</Empty> : null}
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="es-stack">
      <PageHead title="Pedidos e movimentos" subtitle="O que os setores pediram e o que andou no estoque." />
      <div className="es-feed">
        <Panel title={`Solicitações pendentes (${data.requests.length})`} actions={<Link href={`${base}/estoque/solicitacoes`}>Atender</Link>}>
          {data.requests.length === 0 ? <Empty>Nenhuma solicitação pendente.</Empty> : null}
          <ul className="es-cards">
            {data.requests.map((r) => (
              <li key={r.id} className="es-card">
                <div className="es-row es-between">
                  <strong>
                    Nº {r.number}
                    {r.sector ? ` · ${r.sector.name}` : ''}
                  </strong>
                  <Badge tone={r.status === 'authorized' ? 'ok' : 'warn'}>{REQ_LABEL[r.status] ?? r.status}</Badge>
                </div>
                <small>
                  {data.names[r.requested_by] ?? '—'} · {formatDateTime(r.requested_at, timezone)}
                </small>
                <p>{r.items.map((i) => `${fmtQty(i.quantity, i.material?.unit)} ${i.material?.name ?? ''}`).join(' · ')}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Linha do tempo" actions={<Link href={`${base}/estoque/movimentos`}>Ver tudo</Link>}>
          <ol className="es-timeline">
            {data.moves.map((m) => (
              <li key={m.id} data-kind={m.kind}>
                <span className="es-dot" aria-hidden="true" />
                <div>
                  <strong>
                    {MOVE_LABEL[m.kind] ?? m.kind} · {fmtQty(Math.abs(Number(m.qty)), m.material?.unit)} {m.material?.name}
                  </strong>
                  <small>
                    {formatDateTime(m.created_at, timezone)} · {data.names[m.created_by] ?? '—'}
                    {m.reason ? ` · ${m.reason}` : ''}
                  </small>
                </div>
              </li>
            ))}
          </ol>
          {data.moves.length === 0 ? <Empty>Sem movimentações.</Empty> : null}
        </Panel>
      </div>
      <Panel title="Atenção">
        <ul className="es-cards es-cards--row">
          {rows
            .filter((r) => status(r) !== 'ok')
            .map((r) => (
              <li key={r.material_id} className="es-card" data-tone={status(r)}>
                <strong>{r.name}</strong>
                <small>
                  {fmtQty(r.available_qty, r.unit)} disponível · mínimo {fmtQty(r.min_qty, r.unit)}
                </small>
                {r.next_expiry ? <Badge tone={expiryTone(r.next_expiry, today)}>vence {fmtDay(r.next_expiry)}</Badge> : null}
              </li>
            ))}
        </ul>
      </Panel>
    </div>
  );
}
