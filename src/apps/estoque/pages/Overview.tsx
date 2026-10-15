import Link from 'next/link';
import type { VisualModel } from '@/core/apps';
import { formatDateTime } from '@/core/dates';
import { FoodArt } from '@/core/ui/FoodArt';
import { Icon, type IconName } from '@/core/ui/Icon';
import { LotsBoard } from '@/apps/estoque/pages/LotsBoard';
import type { Lot, MaterialRequest, Movement, OverviewRow } from '@/apps/estoque/queries';
import { Empty, MOVE_LABEL, PageHead, Panel, REQ_LABEL, fmtDay, fmtQty } from '@/apps/estoque/ui';

type Data = {
  rows: OverviewRow[];
  lots: Lot[];
  requests: MaterialRequest[];
  moves: Movement[];
  counts: { id: string; status: string; started_at: string; closed_at: string | null; location: { name: string } | null }[];
  names: Record<string, string>;
};

type Tone = 'ok' | 'warn' | 'danger' | 'info';

function Tiles({ items }: { items: { label: string; value: number | string; icon: IconName; tone: Tone; hint?: string }[] }) {
  return (
    <div className="es-tiles">
      {items.map((t) => (
        <div key={t.label} className="es-tile" data-tone={t.tone}>
          <span className="es-tile-icon">
            <Icon name={t.icon} size={20} />
          </span>
          <span className="es-tile-label">{t.label}</span>
          <strong>{t.value}</strong>
          {t.hint ? <small>{t.hint}</small> : null}
        </div>
      ))}
    </div>
  );
}

function Product({ name, sub }: { name: string; sub?: string | null }) {
  return (
    <span className="es-prod">
      <span className="es-thumb">
        <FoodArt name={name} category={sub} label="" />
      </span>
      <span className="es-prod-text">
        <strong>{name}</strong>
        {sub ? <small>{sub}</small> : null}
      </span>
    </span>
  );
}

const MOVE_ICON: Record<string, IconName> = { entrada: 'package-check', saida: 'arrow-up-right', transferencia: 'transfer', ajuste: 'scale', perda: 'trend-down', descarte: 'trend-down' };

/** Saldos do estoque com composição própria para cada modelo. */
export function Overview({ data, model, base, today, timezone }: { data: Data; model: VisualModel; base: string; today: string; timezone: string }) {
  const { rows } = data;
  const gauge = (r: OverviewRow) => {
    const target = Math.max(Number(r.min_qty) * 2, Number(r.min_qty) + Number(r.reorder_qty), 1);
    return Math.min(100, (Number(r.available_qty) / target) * 100);
  };
  const situation = (r: OverviewRow): { label: string; tone: Tone } => {
    if (Number(r.expired_qty) > 0) return { label: 'Lote vencido', tone: 'danger' };
    if (Number(r.available_qty) <= 0) return { label: 'Sem estoque', tone: 'danger' };
    if (r.below_min) return { label: 'Estoque baixo', tone: 'warn' };
    if (Number(r.expiring_qty) > 0) return { label: 'Vencendo', tone: 'warn' };
    return { label: 'Adequado', tone: 'ok' };
  };
  const adequate = rows.filter((r) => situation(r).tone === 'ok').length;
  const below = rows.filter((r) => r.below_min).length;
  const expiring = rows.filter((r) => Number(r.expiring_qty) > 0 || Number(r.expired_qty) > 0).length;

  // ---------- m2 · Lotes e validade ----------
  if (model === 'm2') {
    return (
      <div className="es-stack">
        <PageHead
          title="Lotes e validade"
          subtitle="Acompanhe a validade dos produtos e evite desperdícios: vence primeiro, sai primeiro."
          actions={
            <Link className="es-btn es-btn--primary" href={`${base}/estoque/entrada`}>
              <Icon name="plus" size={16} /> Novo lote
            </Link>
          }
        />
        <LotsBoard lots={data.lots} today={today} base={base} />
      </div>
    );
  }

  // ---------- m3 · Conferência e inventário ----------
  if (model === 'm3') {
    const open = data.counts.find((c) => c.status === 'open');
    const last = data.counts.find((c) => c.status === 'closed');
    const step = open ? 2 : 1;
    return (
      <div className="es-stack">
        <PageHead
          title="Conferência de inventário"
          subtitle="Selecione o local, conte os itens e revise as divergências antes de fechar."
          actions={
            <Link className="es-btn es-btn--primary" href={`${base}/estoque/inventario`}>
              {open ? 'Continuar contagem' : 'Iniciar conferência'} <Icon name="arrow-right" size={16} />
            </Link>
          }
        />
        <ol className="es-steps" aria-label="Etapas">
          {['Selecionar localização', 'Contar produtos', 'Revisar e finalizar'].map((s, i) => (
            <li key={s} data-state={i + 1 < step ? 'done' : i + 1 === step ? 'current' : 'todo'}>
              <span>{i + 1 < step ? <Icon name="check" size={16} /> : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <div className="es-count-head">
          <Panel>
            <div className="es-loc">
              <span className="es-loc-icon">
                <Icon name="pin" size={22} />
              </span>
              <span>
                <small>{open ? 'Localização atual' : 'Última conferência'}</small>
                <strong>{open ? (open.location?.name ?? 'Estoque geral') : last ? (last.location?.name ?? 'Estoque geral') : 'Nenhuma ainda'}</strong>
              </span>
            </div>
            <p className="es-sub">
              {open
                ? `Aberta em ${formatDateTime(open.started_at, timezone)}.`
                : last
                  ? `Fechada em ${formatDateTime(last.closed_at, timezone)}.`
                  : 'Comece pela câmara fria ou pelo depósito seco.'}
            </p>
            <span className="es-progress" style={{ ['--p' as string]: `${rows.length ? (adequate / rows.length) * 100 : 0}%` }}>
              <span />
            </span>
            <small className="es-sub">
              {adequate} de {rows.length} materiais sem divergência de nível
            </small>
          </Panel>
          <Tiles
            items={[
              { label: 'Materiais', value: rows.length, icon: 'boxes', tone: 'info' },
              { label: 'Abaixo do mínimo', value: below, icon: 'trend-down', tone: 'warn' },
              { label: 'Com validade crítica', value: expiring, icon: 'alert', tone: 'danger' },
            ]}
          />
        </div>
        <Panel title="Checklist de saldos">
          {rows.length === 0 ? (
            <Empty>Nenhum material cadastrado.</Empty>
          ) : (
            <div className="es-table-wrap">
              <table className="es-table">
                <thead>
                  <tr>
                    <th aria-label="Conferido" />
                    <th>Produto</th>
                    <th className="es-num">Sistema</th>
                    <th className="es-num">Mínimo</th>
                    <th>Validade</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const s = situation(r);
                    return (
                      <tr key={r.material_id} data-tone={s.tone}>
                        <td>
                          <span className="es-checkbox" data-tone={s.tone}>
                            <Icon name={s.tone === 'ok' ? 'check' : 'alert'} size={14} />
                          </span>
                        </td>
                        <td>
                          <Product name={r.name} sub={r.category} />
                        </td>
                        <td className="es-num">{fmtQty(r.available_qty, r.unit)}</td>
                        <td className="es-num">{fmtQty(r.min_qty, r.unit)}</td>
                        <td>{fmtDay(r.next_expiry)}</td>
                        <td>
                          <span className="es-pill" data-tone={s.tone}>
                            {s.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    );
  }

  // ---------- m4 · Solicitações e movimentações ----------
  if (model === 'm4') {
    const requested = data.requests.filter((r) => r.status === 'requested').length;
    const authorized = data.requests.filter((r) => r.status === 'authorized').length;
    return (
      <div className="es-req-layout">
        <aside className="es-req-side">
          <h2 className="es-h2">
            <Icon name="bag" size={18} /> Solicitar material
          </h2>
          <p className="es-sub">Peça materiais para o seu setor e acompanhe a separação.</p>
          <Link className="es-btn es-btn--primary" href={`${base}/estoque/solicitacoes`}>
            <Icon name="plus" size={16} /> Nova solicitação
          </Link>
          <nav className="es-req-links" aria-label="Atalhos">
            <Link href={`${base}/estoque/solicitacoes`}>
              <Icon name="clipboard" size={16} /> Solicitações <b>{data.requests.length}</b>
            </Link>
            <Link href={`${base}/estoque/movimentos`}>
              <Icon name="history" size={16} /> Movimentações
            </Link>
            <Link href={`${base}/estoque/entrada`}>
              <Icon name="package-check" size={16} /> Entradas
            </Link>
          </nav>
        </aside>
        <div className="es-stack">
          <Tiles
            items={[
              { label: 'Em aberto', value: requested, icon: 'clock', tone: 'info' },
              { label: 'Autorizadas', value: authorized, icon: 'check', tone: 'ok' },
              { label: 'Abaixo do mínimo', value: below, icon: 'trend-down', tone: 'warn' },
              { label: 'Movimentos recentes', value: data.moves.length, icon: 'transfer', tone: 'info' },
            ]}
          />
          <Panel title="Solicitações de material" actions={<Link href={`${base}/estoque/solicitacoes`} className="es-link">Atender</Link>}>
            {data.requests.length === 0 ? (
              <Empty>Nenhuma solicitação pendente.</Empty>
            ) : (
              <div className="es-table-wrap">
                <table className="es-table">
                  <thead>
                    <tr>
                      <th>Nº</th>
                      <th>Data</th>
                      <th>Solicitante</th>
                      <th>Itens</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.requests.map((r) => (
                      <tr key={r.id}>
                        <td className="es-mono">#{String(r.number).padStart(4, '0')}</td>
                        <td>{formatDateTime(r.requested_at, timezone)}</td>
                        <td>
                          {data.names[r.requested_by] ?? '—'}
                          {r.sector ? <small className="es-sub"> · {r.sector.name}</small> : null}
                        </td>
                        <td>{r.items.map((i) => `${fmtQty(i.quantity, i.material?.unit)} ${i.material?.name ?? ''}`).join(', ')}</td>
                        <td>
                          <span className="es-pill" data-tone={r.status === 'authorized' ? 'ok' : 'info'}>
                            {REQ_LABEL[r.status] ?? r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <div className="es-split">
            <Panel title="Movimentações recentes" actions={<Link href={`${base}/estoque/movimentos`} className="es-link">Ver todas</Link>}>
              {data.moves.length === 0 ? <Empty>Sem movimentações.</Empty> : null}
              <ul className="es-moves">
                {data.moves.slice(0, 6).map((m) => (
                  <li key={m.id} data-kind={m.kind}>
                    <span className="es-move-icon">
                      <Icon name={MOVE_ICON[m.kind] ?? 'transfer'} size={16} />
                    </span>
                    <span className="es-move-text">
                      <strong>
                        {MOVE_LABEL[m.kind] ?? m.kind} · {m.material?.name}
                      </strong>
                      <small>
                        {formatDateTime(m.created_at, timezone)} · {data.names[m.created_by] ?? '—'}
                      </small>
                    </span>
                    <span className="es-move-qty">
                      {Number(m.qty) >= 0 ? '+' : '−'}
                      {fmtQty(Math.abs(Number(m.qty)), m.material?.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Estoque mínimo">
              {rows.filter((r) => r.below_min).length === 0 ? <Empty>Todos os materiais acima do mínimo.</Empty> : null}
              <ul className="es-moves">
                {rows
                  .filter((r) => r.below_min)
                  .map((r) => (
                    <li key={r.material_id} data-kind="alerta">
                      <span className="es-move-icon">
                        <Icon name="alert" size={16} />
                      </span>
                      <span className="es-move-text">
                        <strong>{r.name}</strong>
                        <small>
                          Atual {fmtQty(r.available_qty, r.unit)} · mínimo {fmtQty(r.min_qty, r.unit)}
                        </small>
                      </span>
                    </li>
                  ))}
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    );
  }

  // ---------- m1 · Controle industrial ----------
  return (
    <div className="es-stack">
      <PageHead
        title="Estoque"
        subtitle="Visão geral do seu estoque em tempo real."
        actions={
          <Link className="es-btn es-btn--primary" href={`${base}/estoque/entrada`}>
            <Icon name="plus" size={16} /> Registrar entrada
          </Link>
        }
      />
      <Tiles
        items={[
          { label: 'Total de materiais', value: rows.length, icon: 'boxes', tone: 'info', hint: 'ativos' },
          { label: 'Estoque adequado', value: adequate, icon: 'package-check', tone: 'ok', hint: 'materiais' },
          { label: 'Estoque baixo', value: below, icon: 'trend-down', tone: 'warn', hint: 'abaixo do mínimo' },
          { label: 'Validade crítica', value: expiring, icon: 'alert', tone: 'danger', hint: 'vencidos ou em 7 dias' },
        ]}
      />
      <Panel>
        {rows.length === 0 ? (
          <Empty>Nenhum material cadastrado.</Empty>
        ) : (
          <div className="es-table-wrap">
            <table className="es-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Nível</th>
                  <th className="es-num">Disponível</th>
                  <th className="es-num">Mínimo</th>
                  <th className="es-num">Bloqueado</th>
                  <th>Próx. validade</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = situation(r);
                  return (
                    <tr key={r.material_id}>
                      <td>
                        <Product name={r.name} sub={r.category} />
                      </td>
                      <td>
                        <span className="es-gauge" data-tone={s.tone}>
                          <span style={{ width: `${gauge(r)}%` }} />
                        </span>
                      </td>
                      <td className="es-num">{fmtQty(r.available_qty, r.unit)}</td>
                      <td className="es-num">{fmtQty(r.min_qty, r.unit)}</td>
                      <td className="es-num">{Number(r.blocked_qty) ? fmtQty(r.blocked_qty, r.unit) : '—'}</td>
                      <td>{fmtDay(r.next_expiry)}</td>
                      <td>
                        <span className="es-pill" data-tone={s.tone}>
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
