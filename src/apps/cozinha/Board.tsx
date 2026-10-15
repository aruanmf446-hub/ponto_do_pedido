'use client';

import { useEffect, useMemo, useState } from 'react';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { Dialog } from '@/core/ui/Dialog';
import { LiveRefresh } from '@/core/ui/LiveRefresh';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { advance, cancelFromKitchen, deliverFromKitchen, markUnavailable, setAvailable } from '@/apps/cozinha/actions';
import type { KitchenOrder } from '@/apps/cozinha/queries';

type Filter = 'todos' | 'salao' | 'delivery' | 'balcao';

const CHANNEL: Record<string, string> = { salao: 'Mesa', delivery: 'Delivery', balcao: 'Retirada' };

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function where(o: KitchenOrder) {
  if (!o.tab) return '';
  if (o.tab.channel === 'salao') return `Mesa ${o.tab.table?.label ?? ''}`;
  return `${CHANNEL[o.tab.channel] ?? ''}${o.tab.customer_name ? ` · ${o.tab.customer_name}` : ''}`;
}

export function KitchenBoard({ orders, unavailable, stages }: { orders: KitchenOrder[]; unavailable: { id: string; name: string }[]; stages: string[] }) {
  const { tenantId, model } = useTenant();
  const canPrep = usePermission('cozinha.preparo.executar') === 'direct';
  const canFlag = usePermission('cozinha.item.indisponivel') === 'direct';
  const canDeliver = usePermission('cozinha.entrega.confirmar') === 'direct';
  const canCancel = usePermission('cozinha.pedido.cancelar') !== 'deny';
  const action = useAction();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('todos');
  const [focus, setFocus] = useState<KitchenOrder | null>(null);
  const [cancelTarget, setCancelTarget] = useState<KitchenOrder | null>(null);
  const [reason, setReason] = useState('');

  const shown = useMemo(() => orders.filter((o) => filter === 'todos' || o.tab?.channel === filter), [orders, filter]);
  const by = (s: KitchenOrder['status']) => shown.filter((o) => o.status === s);
  const count = (f: Filter) => orders.filter((o) => o.status !== 'delivered' && (f === 'todos' || o.tab?.channel === f)).length;
  const elapsed = (o: KitchenOrder) => Math.max(0, Math.floor((now - new Date(o.started_at ?? o.confirmed_at ?? o.created_at).getTime()) / 60_000));

  const start = (o: KitchenOrder, stage: string | null = stages[0] ?? null) => void action.run(() => advance(tenantId, o.id, 'preparing', stage));
  const ready = (o: KitchenOrder) => void action.run(() => advance(tenantId, o.id, 'ready', null));
  const deliver = (o: KitchenOrder) => void action.run(() => deliverFromKitchen(tenantId, o.id));

  const card = (o: KitchenOrder, compact = false) => {
    const mins = elapsed(o);
    const late = o.status !== 'delivered' && mins >= 20;
    return (
      <article key={o.id} className="kz-card" data-status={o.status} data-late={late} data-issue={o.has_issue}>
        <header className="kz-card-head">
          <strong className="kz-num">#{o.number}</strong>
          <span className="kz-chip" data-channel={o.tab?.channel}>
            {CHANNEL[o.tab?.channel ?? ''] ?? '—'}
          </span>
          <span className="kz-time" aria-label={`${mins} minutos`}>
            {o.status === 'delivered' ? 'Entregue' : `${mins} min`}
          </span>
        </header>
        <p className="kz-where">{where(o)}</p>
        {o.stage && o.status === 'preparing' ? <p className="kz-stage">Etapa: {o.stage}</p> : null}
        <ul className="kz-items">
          {o.items.map((i) => (
            <li key={i.id} data-status={i.status}>
              <span>
                <b>{i.quantity}×</b> {i.name}
                {i.notes ? <em> — {i.notes}</em> : null}
                {i.status === 'unavailable' ? <em className="kz-flag"> indisponível</em> : null}
                {i.status === 'cancelled' ? <em className="kz-flag"> cancelado</em> : null}
              </span>
              {canFlag && i.status === 'active' && (o.status === 'confirmed' || o.status === 'preparing') && !compact ? (
                <button
                  type="button"
                  className="kz-link"
                  onClick={() => void action.run(() => markUnavailable(tenantId, i.id, 'Sem ingrediente'))}
                  aria-label={`Sinalizar ${i.name} como indisponível`}
                >
                  Indisponível
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {o.notes ? <p className="kz-notes">Obs.: {o.notes}</p> : null}
        {o.has_issue ? <p className="kz-issue">Aguardando o atendimento resolver a indisponibilidade.</p> : null}
        <div className="kz-actions">
          {o.status === 'confirmed' && canPrep ? (
            <button type="button" className="kz-btn kz-btn--go" disabled={action.pending} onClick={() => start(o)}>
              Iniciar preparo
            </button>
          ) : null}
          {o.status === 'preparing' && canPrep && stages.length > 1 && !compact ? (
            <select
              className="kz-select"
              aria-label="Etapa"
              value={o.stage ?? ''}
              onChange={(e) => void action.run(() => advance(tenantId, o.id, 'preparing', e.target.value || null))}
            >
              {stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : null}
          {o.status === 'preparing' && canPrep ? (
            <button type="button" className="kz-btn kz-btn--ready" disabled={action.pending || o.has_issue} onClick={() => ready(o)}>
              Marcar pronto
            </button>
          ) : null}
          {o.status === 'ready' && o.delivery_by === 'cozinha' && o.source !== 'delivery' && canDeliver ? (
            <button type="button" className="kz-btn kz-btn--go" disabled={action.pending} onClick={() => deliver(o)}>
              Entregar
            </button>
          ) : null}
          {o.status === 'ready' && o.delivery_by !== 'cozinha' ? (
            <span className="kz-wait">{o.source === 'delivery' ? 'Aguardando saída para entrega' : 'Aguardando retirada do atendimento'}</span>
          ) : null}
          {(o.status === 'confirmed' || o.status === 'preparing') && canCancel && !compact ? (
            <button type="button" className="kz-link" onClick={() => (setCancelTarget(o), setReason(''))}>
              Cancelar
            </button>
          ) : null}
        </div>
      </article>
    );
  };

  const filters = (
    <div className="kz-filters" role="group" aria-label="Canal">
      {(
        [
          ['todos', 'Todos'],
          ['salao', 'Salão'],
          ['delivery', 'Delivery'],
          ['balcao', 'Retirada'],
        ] as [Filter, string][]
      ).map(([f, label]) => (
        <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
          {label} <span>{count(f)}</span>
        </button>
      ))}
    </div>
  );

  const unavailableBar =
    unavailable.length > 0 ? (
      <div className="kz-unavailable" role="status">
        <strong>Indisponíveis:</strong>
        {unavailable.map((p) => (
          <span key={p.id}>
            {p.name}
            {canFlag ? (
              <button type="button" className="kz-link" onClick={() => void action.run(() => setAvailable(tenantId, p.id, true))}>
                liberar
              </button>
            ) : null}
          </span>
        ))}
      </div>
    ) : null;

  const columns = (cols: { key: string; title: string; items: KitchenOrder[] }[]) => (
    <div className="kz-columns" style={{ ['--kz-cols' as string]: cols.length }}>
      {cols.map((c) => (
        <section key={c.key} className="kz-col" data-col={c.key} aria-label={c.title}>
          <h2 className="kz-col-title">
            {c.title} <span>{c.items.length}</span>
          </h2>
          <div className="kz-col-body">{c.items.map((o) => card(o))}</div>
        </section>
      ))}
    </div>
  );

  let body;
  if (model === 'm2') {
    const queue = shown.filter((o) => o.status !== 'delivered');
    body = (
      <div className="kz-rail" aria-label="Fila de produção">
        {queue.length === 0 ? <p className="kz-empty">Sem pedidos na fila.</p> : null}
        {queue.map((o) => card(o))}
      </div>
    );
  } else if (model === 'm3') {
    const stageList = stages.length ? stages : ['Preparo'];
    const preparing = by('preparing');
    body = columns([
      { key: 'novo', title: 'A iniciar', items: by('confirmed') },
      ...stageList.map((s, i) => ({
        key: `s${i}`,
        title: s,
        items: preparing.filter((o) => (o.stage ?? stageList[0]) === s || (i === 0 && o.stage && !stageList.includes(o.stage))),
      })),
      { key: 'pronto', title: 'Pronto para saída', items: by('ready') },
    ]);
  } else if (model === 'm4') {
    const queue = shown.filter((o) => o.status === 'confirmed' || o.status === 'preparing');
    const current = (focus && queue.find((o) => o.id === focus.id)) ?? queue.find((o) => o.status === 'preparing') ?? queue[0] ?? null;
    const readyList = by('ready');
    body = (
      <div className="kz-command">
        <section className="kz-current" aria-label="Pedido atual">
          {current ? (
            <>
              <div className="kz-timer" role="timer" aria-label={`${elapsed(current)} minutos`}>
                <span>{String(elapsed(current)).padStart(2, '0')}</span>
                <small>min {current.status === 'preparing' ? 'em preparo' : 'na fila'}</small>
              </div>
              {card(current)}
            </>
          ) : (
            <p className="kz-empty">Nenhum pedido aguardando. Bom trabalho!</p>
          )}
        </section>
        <aside className="kz-next" aria-label="Próximos">
          <h2>Próximos ({Math.max(0, queue.length - (current ? 1 : 0))})</h2>
          <ul>
            {queue
              .filter((o) => o.id !== current?.id)
              .map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => setFocus(o)}>
                    <strong>#{o.number}</strong> {where(o)}
                    <small>
                      {o.items.length} itens · {elapsed(o)} min
                    </small>
                  </button>
                </li>
              ))}
          </ul>
          <h2>Prontos ({readyList.length})</h2>
          <div className="kz-ready-list">{readyList.map((o) => card(o, true))}</div>
        </aside>
        <footer className="kz-stats">
          <span>
            <b>{by('confirmed').length}</b> na fila
          </span>
          <span>
            <b>{by('preparing').length}</b> em preparo
          </span>
          <span>
            <b>{readyList.length}</b> prontos
          </span>
          <span>
            <b>{by('delivered').length}</b> entregues (2h)
          </span>
        </footer>
      </div>
    );
  } else {
    body = columns([
      { key: 'recebidos', title: 'Recebidos', items: by('confirmed') },
      { key: 'preparo', title: 'Em preparo', items: by('preparing') },
      { key: 'pronto', title: 'Prontos', items: by('ready') },
      { key: 'entregue', title: 'Entregues', items: by('delivered') },
    ]);
  }

  return (
    <div className="kz-board">
      <LiveRefresh tenantId={tenantId} tables={['orders', 'order_items']} fallbackSeconds={20} />
      <div className="kz-toolbar">
        <h1 className="kz-title">Pedidos da cozinha</h1>
        {filters}
      </div>
      {unavailableBar}
      {action.error ? (
        <p className="kz-error" role="alert">
          {action.error.message}
        </p>
      ) : null}
      {body}
      {cancelTarget ? (
        <Dialog open onClose={() => setCancelTarget(null)} title={`Cancelar pedido #${cancelTarget.number}`}>
          <div className="kz-form">
            <label className="kz-field">
              Motivo
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <button
              type="button"
              className="kz-btn"
              disabled={reason.trim().length < 3 || action.pending}
              onClick={() =>
                void action.run(() => cancelFromKitchen(tenantId, cancelTarget.id, reason.trim()), {
                  onSuccess: () => setCancelTarget(null),
                  approval: {
                    kind: 'order.cancel',
                    summary: `Cancelar pedido #${cancelTarget.number} na produção`,
                    payload: { order_id: cancelTarget.id, reason: reason.trim(), context: 'cozinha' },
                  },
                })
              }
            >
              Confirmar cancelamento
            </button>
          </div>
        </Dialog>
      ) : null}
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </div>
  );
}

