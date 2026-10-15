'use client';

import { useEffect, useMemo, useState } from 'react';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { Dialog } from '@/core/ui/Dialog';
import { FoodArt } from '@/core/ui/FoodArt';
import { Icon, type IconName } from '@/core/ui/Icon';
import { LiveRefresh } from '@/core/ui/LiveRefresh';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { advance, cancelFromKitchen, deliverFromKitchen, markUnavailable, setAvailable } from '@/apps/cozinha/actions';
import type { KitchenOrder } from '@/apps/cozinha/queries';

type Filter = 'todos' | 'salao' | 'delivery' | 'balcao';

const CHANNEL: Record<string, string> = { salao: 'Mesa', delivery: 'Delivery', balcao: 'Retirada' };
const CHANNEL_ICON: Record<string, IconName> = { salao: 'utensils', delivery: 'truck', balcao: 'bag' };
const STATUS_LABEL: Record<KitchenOrder['status'], string> = {
  confirmed: 'Recebido',
  preparing: 'Em preparo',
  ready: 'Pronto',
  delivered: 'Entregue',
};
/** Tempo de referência para um pedido (min): acima disso ele aparece como atrasado. */
const TARGET_MIN = 20;
const STATION_ICONS: IconName[] = ['chef', 'flame', 'sparkles', 'layers', 'utensils'];

function useNow(intervalMs: number) {
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
  const { tenantId, model, timezone } = useTenant();
  const timeFmt = useMemo(() => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone }), [timezone]);
  const hhmm = (iso: string | null) => (iso ? timeFmt.format(new Date(iso)) : '');
  const canPrep = usePermission('cozinha.preparo.executar') === 'direct';
  const canFlag = usePermission('cozinha.item.indisponivel') === 'direct';
  const canDeliver = usePermission('cozinha.entrega.confirmar') === 'direct';
  const canCancel = usePermission('cozinha.pedido.cancelar') !== 'deny';
  const action = useAction();
  const now = useNow(model === 'm4' ? 1_000 : 30_000);
  const [filter, setFilter] = useState<Filter>('todos');
  const [focus, setFocus] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<KitchenOrder | null>(null);
  const [reason, setReason] = useState('');

  const shown = useMemo(() => orders.filter((o) => filter === 'todos' || o.tab?.channel === filter), [orders, filter]);
  const by = (s: KitchenOrder['status']) => shown.filter((o) => o.status === s);
  const count = (f: Filter) => orders.filter((o) => o.status !== 'delivered' && (f === 'todos' || o.tab?.channel === f)).length;
  const seconds = (o: KitchenOrder) => Math.max(0, Math.floor((now - new Date(o.started_at ?? o.confirmed_at ?? o.created_at).getTime()) / 1000));
  const elapsed = (o: KitchenOrder) => Math.floor(seconds(o) / 60);
  const progress = (o: KitchenOrder) =>
    o.status === 'ready' || o.status === 'delivered' ? 1 : o.status === 'confirmed' ? 0.08 : Math.min(0.95, Math.max(0.12, elapsed(o) / TARGET_MIN));

  const start = (o: KitchenOrder, stage: string | null = stages[0] ?? null) => void action.run(() => advance(tenantId, o.id, 'preparing', stage));
  const ready = (o: KitchenOrder) => void action.run(() => advance(tenantId, o.id, 'ready', null));
  const deliver = (o: KitchenOrder) => void action.run(() => deliverFromKitchen(tenantId, o.id));

  const actions = (o: KitchenOrder, compact: boolean) => (
    <div className="kz-actions">
      {o.status === 'confirmed' && canPrep ? (
        <button type="button" className="kz-btn kz-btn--go" disabled={action.pending} onClick={() => start(o)}>
          <Icon name="flame" size={16} /> Iniciar preparo
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
          <Icon name="check" size={16} /> Marcar pronto
        </button>
      ) : null}
      {o.status === 'ready' && o.delivery_by === 'cozinha' && o.source !== 'delivery' && canDeliver ? (
        <button type="button" className="kz-btn kz-btn--deliver" disabled={action.pending} onClick={() => deliver(o)}>
          <Icon name="service" size={16} /> Entregar
        </button>
      ) : null}
      {o.status === 'ready' && o.delivery_by !== 'cozinha' ? (
        <span className="kz-wait">
          <Icon name="clock" size={14} />
          {o.source === 'delivery' ? 'Aguardando saída para entrega' : 'Aguardando retirada do atendimento'}
        </span>
      ) : null}
      {(o.status === 'confirmed' || o.status === 'preparing') && canCancel && !compact ? (
        <button type="button" className="kz-link kz-cancel" onClick={() => (setCancelTarget(o), setReason(''))}>
          Cancelar
        </button>
      ) : null}
    </div>
  );

  const card = (o: KitchenOrder, compact = false) => {
    const mins = elapsed(o);
    const late = (o.status === 'confirmed' || o.status === 'preparing') && mins >= TARGET_MIN;
    const channel = o.tab?.channel ?? '';
    return (
      <article key={o.id} className="kz-card" data-status={o.status} data-late={late} data-issue={o.has_issue}>
        <div className="kz-band">
          <span>{STATUS_LABEL[o.status]}</span>
          <span suppressHydrationWarning>{o.status === 'delivered' ? hhmm(o.delivered_at) : `${mins} min`}</span>
        </div>
        <header className="kz-card-head">
          <strong className="kz-num">#{o.number}</strong>
          <span className="kz-chip" data-channel={channel}>
            {CHANNEL_ICON[channel] ? <Icon name={CHANNEL_ICON[channel]} size={12} /> : null}
            {CHANNEL[channel] ?? '—'}
          </span>
          <span className="kz-clock">{hhmm(o.confirmed_at ?? o.created_at)}</span>
        </header>
        <p className="kz-where">{where(o)}</p>
        {o.stage && o.status === 'preparing' ? (
          <p className="kz-stage">
            <Icon name="layers" size={13} /> {o.stage}
          </p>
        ) : null}
        <ul className="kz-items">
          {o.items.map((i) => (
            <li key={i.id} data-status={i.status}>
              {compact ? null : (
                <span className="kz-thumb">
                  <FoodArt name={i.name} label="" />
                </span>
              )}
              <span className="kz-item-text">
                <span>
                  <b>{i.quantity}×</b> {i.name}
                </span>
                {i.notes ? <em className="kz-note">{i.notes}</em> : null}
                {i.status === 'unavailable' ? <em className="kz-flag">indisponível</em> : null}
                {i.status === 'cancelled' ? <em className="kz-flag">cancelado</em> : null}
              </span>
              {canFlag && i.status === 'active' && (o.status === 'confirmed' || o.status === 'preparing') && !compact ? (
                <button
                  type="button"
                  className="kz-link kz-item-flag"
                  onClick={() => void action.run(() => markUnavailable(tenantId, i.id, 'Sem ingrediente'))}
                  aria-label={`Sinalizar ${i.name} como indisponível`}
                  title="Sinalizar como indisponível"
                >
                  <Icon name="alert" size={14} />
                  <span>Indisponível</span>
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {o.notes ? (
          <p className="kz-notes">
            <Icon name="file" size={13} /> {o.notes}
          </p>
        ) : null}
        {o.has_issue ? <p className="kz-issue">Aguardando o atendimento resolver a indisponibilidade.</p> : null}
        {o.status !== 'delivered' ? (
          <div className="kz-progress" style={{ ['--p' as string]: progress(o) }} suppressHydrationWarning>
            <span />
          </div>
        ) : null}
        <footer className="kz-card-foot">
          <span className="kz-time" aria-label={`${mins} minutos`} suppressHydrationWarning>
            <Icon name={o.status === 'delivered' ? 'check' : 'timer'} size={14} />
            {o.status === 'delivered' ? `Entregue ${hhmm(o.delivered_at)}` : `${mins} min`}
          </span>
          {actions(o, compact)}
        </footer>
      </article>
    );
  };

  const filters = (
    <div className="kz-filters" role="group" aria-label="Canal">
      {(
        [
          ['todos', 'Todos', 'grid'],
          ['salao', 'Salão', 'utensils'],
          ['delivery', 'Delivery', 'truck'],
          ['balcao', 'Retirada', 'bag'],
        ] as [Filter, string, IconName][]
      ).map(([f, label, icon]) => (
        <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
          <Icon name={icon} size={15} />
          {label} <span>{count(f)}</span>
        </button>
      ))}
    </div>
  );

  const unavailableBar =
    unavailable.length > 0 ? (
      <div className="kz-unavailable" role="status">
        <Icon name="alert" size={16} />
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

  const columns = (cols: { key: string; title: string; icon: IconName; tone: string; items: KitchenOrder[] }[]) => (
    <div className="kz-columns" style={{ ['--kz-cols' as string]: cols.length }}>
      {cols.map((c) => (
        <section key={c.key} className="kz-col" data-tone={c.tone} aria-label={c.title}>
          <h2 className="kz-col-title">
            <Icon name={c.icon} size={17} />
            <span className="kz-col-name">{c.title}</span>
            <span className="kz-col-count">{c.items.length}</span>
          </h2>
          <div className="kz-col-body">
            {c.items.length === 0 ? <p className="kz-col-empty">Nada por aqui.</p> : null}
            {c.items.map((o) => card(o))}
          </div>
        </section>
      ))}
    </div>
  );

  const stats = (
    <div className="kz-stats">
      {(
        [
          ['receipt', 'Recebidos', by('confirmed').length, 'new'],
          ['flame', 'Em preparo', by('preparing').length, 'prep'],
          ['check', 'Prontos', by('ready').length, 'ready'],
          ['package-check', 'Entregues (2h)', by('delivered').length, 'done'],
        ] as [IconName, string, number, string][]
      ).map(([icon, label, n, tone]) => (
        <span key={label} className="kz-stat" data-tone={tone}>
          <Icon name={icon} size={18} />
          <b>{n}</b>
          <small>{label}</small>
        </span>
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
      { key: 'novo', title: 'A iniciar', icon: 'receipt', tone: 'new', items: by('confirmed') },
      ...stageList.map((s, i) => ({
        key: `s${i}`,
        title: s,
        icon: STATION_ICONS[i % STATION_ICONS.length]!,
        tone: `s${i % 4}`,
        items: preparing.filter((o) => (o.stage ?? stageList[0]) === s || (i === 0 && o.stage && !stageList.includes(o.stage))),
      })),
      { key: 'pronto', title: 'Pronto para saída', icon: 'bag', tone: 'ready', items: by('ready') },
    ]);
  } else if (model === 'm4') {
    const queue = shown.filter((o) => o.status === 'confirmed' || o.status === 'preparing');
    const current = queue.find((o) => o.id === focus) ?? queue.find((o) => o.status === 'preparing') ?? queue[0] ?? null;
    const readyList = by('ready');
    const secs = current ? seconds(current) : 0;
    const ring = current ? Math.min(1, secs / (TARGET_MIN * 60)) : 0;
    const R = 92;
    const C = 2 * Math.PI * R;
    body = (
      <div className="kz-command">
        <section className="kz-current" aria-label="Pedido atual">
          <h2 className="kz-section-title">Pedido atual</h2>
          {current ? (
            <div className="kz-current-body">
              <div className="kz-ring" suppressHydrationWarning role="timer" aria-label={`${Math.floor(secs / 60)} minutos`} data-late={secs >= TARGET_MIN * 60}>
                <svg viewBox="0 0 220 220" aria-hidden="true">
                  <circle cx="110" cy="110" r={R} className="kz-ring-track" />
                  <circle cx="110" cy="110" r={R} className="kz-ring-value" suppressHydrationWarning strokeDasharray={`${C * ring} ${C}`} transform="rotate(-90 110 110)" />
                </svg>
                <span className="kz-ring-time" suppressHydrationWarning>
                  {String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}
                </span>
                <small>{current.status === 'preparing' ? 'em preparo' : 'na fila'}</small>
              </div>
              {card(current)}
            </div>
          ) : (
            <p className="kz-empty">Nenhum pedido aguardando. Bom trabalho!</p>
          )}
        </section>
        <aside className="kz-next" aria-label="Próximos">
          <h2 className="kz-section-title">
            Próximos <span>{Math.max(0, queue.length - (current ? 1 : 0))}</span>
          </h2>
          <ul>
            {queue
              .filter((o) => o.id !== current?.id)
              .map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => setFocus(o.id)} data-late={elapsed(o) >= TARGET_MIN}>
                    <span className="kz-next-text">
                      <strong>
                        #{o.number} <span className="kz-chip" data-channel={o.tab?.channel}>{CHANNEL[o.tab?.channel ?? ''] ?? '—'}</span>
                      </strong>
                      <small>{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</small>
                    </span>
                    <span className="kz-next-time" suppressHydrationWarning>{elapsed(o)} min</span>
                    <span className="kz-thumb">{o.items[0] ? <FoodArt name={o.items[0].name} label="" /> : null}</span>
                  </button>
                </li>
              ))}
          </ul>
          <h2 className="kz-section-title">
            Prontos <span>{readyList.length}</span>
          </h2>
          <div className="kz-ready-list">{readyList.map((o) => card(o, true))}</div>
        </aside>
        {stats}
      </div>
    );
  } else {
    body = columns([
      { key: 'recebidos', title: 'Recebidos', icon: 'receipt', tone: 'new', items: by('confirmed') },
      { key: 'preparo', title: 'Em preparo', icon: 'flame', tone: 'prep', items: by('preparing') },
      { key: 'pronto', title: 'Prontos', icon: 'check', tone: 'ready', items: by('ready') },
      { key: 'entregue', title: 'Entregues', icon: 'package-check', tone: 'done', items: by('delivered') },
    ]);
  }

  return (
    <div className="kz-board">
      <LiveRefresh tenantId={tenantId} tables={['orders', 'order_items']} fallbackSeconds={20} />
      <div className="kz-toolbar">
        <div>
          <h1 className="kz-title">Pedidos da cozinha</h1>
          <p className="kz-sub">Acompanhe e avance cada pedido até a saída.</p>
        </div>
        {filters}
      </div>
      {unavailableBar}
      {action.error ? (
        <p className="kz-error" role="alert">
          {action.error.message}
        </p>
      ) : null}
      {body}
      {model === 'm2' ? stats : null}
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
