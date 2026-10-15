'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { minutesSince } from '@/core/dates';
import { formatCents } from '@/core/money';
import { Icon, type IconName } from '@/core/ui/Icon';
import { useTenant } from '@/core/ui/TenantProvider';
import { newIdempotencyKey, useAction } from '@/core/ui/useAction';
import { openTab, reviewCustomerOrder } from '@/apps/atendimento/actions';
import type { FloorTable, OpenTab, OrderLite } from '@/apps/atendimento/queries';

type Props = {
  sectors: { id: string; name: string }[];
  tables: FloorTable[];
  tabs: OpenTab[];
  orders: OrderLite[];
  canOpen: boolean;
  canConfirmCustomer: boolean;
};

type TableState = 'livre' | 'ocupada' | 'pronto' | 'conta' | 'confirmar';

function stateOf(tab: OpenTab | undefined, orders: OrderLite[]): TableState {
  if (!tab) return 'livre';
  const mine = orders.filter((o) => o.tab_id === tab.id);
  if (mine.some((o) => o.status === 'pending_confirmation')) return 'confirmar';
  if (mine.some((o) => o.status === 'ready')) return 'pronto';
  if (tab.bill_requested_at) return 'conta';
  return 'ocupada';
}

const STATE_LABEL: Record<TableState, string> = {
  livre: 'Livre',
  ocupada: 'Ocupada',
  pronto: 'Pedido pronto',
  conta: 'Pediu a conta',
  confirmar: 'Confirmar pedido',
};

const STATE_ICON: Record<TableState, IconName> = {
  livre: 'check',
  ocupada: 'users',
  pronto: 'bell',
  conta: 'receipt',
  confirmar: 'qr',
};

/** Mesa desenhada com cadeiras ao redor (quantidade pelos lugares). */
function TableShape({ seats, round, label }: { seats: number; round: boolean; label: string }) {
  const n = Math.max(2, Math.min(8, seats));
  const top = Math.ceil(n / 2);
  const bottom = n - top;
  return (
    <span className={`at-shape ${round ? 'at-shape--round' : ''}`} aria-hidden="true">
      <span className="at-chairs at-chairs--top">
        {Array.from({ length: top }, (_, i) => (
          <span key={i} className="at-chair" />
        ))}
      </span>
      <span className="at-shape-top">{label}</span>
      <span className="at-chairs at-chairs--bottom">
        {Array.from({ length: bottom }, (_, i) => (
          <span key={i} className="at-chair" />
        ))}
      </span>
    </span>
  );
}

export function Floor(props: Props) {
  const { model, base, tenantId } = useTenant();
  const router = useRouter();
  const action = useAction();
  const [selected, setSelected] = useState<string | null>(null);
  const [sector, setSector] = useState<string>('all');
  const tabByTable = new Map(props.tabs.filter((t) => t.table_id).map((t) => [t.table_id as string, t]));
  const pending = props.orders.filter((o) => o.status === 'pending_confirmation');
  const ready = props.orders.filter((o) => o.status === 'ready');
  const tabNumber = new Map(props.tabs.map((t) => [t.id, t]));
  const tableLabel = new Map(props.tables.map((t) => [t.id, t.label]));
  const label = (tabId: string) => {
    const tab = tabNumber.get(tabId);
    return tab?.table_id ? `Mesa ${tableLabel.get(tab.table_id)}` : `Comanda #${tab?.number ?? ''}`;
  };
  const counts = (['livre', 'ocupada', 'confirmar', 'pronto', 'conta'] as TableState[]).map((st) => ({
    st,
    n: props.tables.filter((t) => stateOf(tabByTable.get(t.id), props.orders) === st).length,
  }));
  const visibleTables = props.tables.filter((t) => sector === 'all' || (t.sector_id ?? '') === sector);

  const open = (table: FloorTable) => {
    const tab = tabByTable.get(table.id);
    if (tab) return router.push(`${base}/atendimento/comanda/${tab.id}`);
    if (!props.canOpen) return;
    void action.run(() => openTab(tenantId, table.id, '', null, newIdempotencyKey('tab')), {
      refresh: false,
      onSuccess: (t) => router.push(`${base}/atendimento/comanda/${t.id}`),
    });
  };

  const tableButton = (t: FloorTable, variant: string, onClick: () => void = () => open(t)) => {
    const tab = tabByTable.get(t.id);
    const st = stateOf(tab, props.orders);
    return (
      <button
        key={t.id}
        type="button"
        className={`at-table at-table--${variant}`}
        data-state={st}
        aria-pressed={variant === 'map' ? selected === t.id : undefined}
        onClick={onClick}
        disabled={action.pending}
      >
        {variant === 'map' ? <TableShape seats={t.seats} round={t.seats <= 2} label={t.label} /> : <span className="at-table-label">{t.label}</span>}
        <span className="at-table-state">
          <Icon name={STATE_ICON[st]} size={13} /> {STATE_LABEL[st]}
        </span>
        {tab ? (
          <span className="at-table-meta">
            {formatCents(tab.total_cents)} · {minutesSince(tab.opened_at)} min
          </span>
        ) : (
          <span className="at-table-meta">{t.seats} lugares</span>
        )}
      </button>
    );
  };

  const summary = (
    <div className="at-summary" aria-label="Resumo do salão">
      {counts.map(({ st, n }) => (
        <span key={st} className="at-summary-item" data-state={st}>
          <span className="at-summary-dot" />
          {STATE_LABEL[st]} <strong>{n}</strong>
        </span>
      ))}
    </div>
  );

  const sectorTabs =
    props.sectors.length > 1 ? (
      <div className="at-sector-tabs" role="tablist" aria-label="Setores">
        <button type="button" role="tab" aria-selected={sector === 'all'} onClick={() => setSector('all')}>
          Todos <span>{props.tables.length}</span>
        </button>
        {props.sectors.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={sector === s.id} onClick={() => setSector(s.id)}>
            {s.name} <span>{props.tables.filter((t) => t.sector_id === s.id).length}</span>
          </button>
        ))}
      </div>
    ) : null;

  const queues =
    pending.length || ready.length ? (
      <div className="at-queues">
        {pending.length ? (
          <section className="at-panel at-panel--confirm" aria-labelledby="q-confirm">
            <h2 id="q-confirm">
              <Icon name="qr" size={16} /> Pedidos do QR Code para confirmar
            </h2>
            <ul className="at-list">
              {pending.map((o) => (
                <li key={o.id}>
                  <Link href={`${base}/atendimento/comanda/${o.tab_id}`}>
                    #{o.number} · {label(o.tab_id)}
                  </Link>
                  {props.canConfirmCustomer ? (
                    <span className="at-row">
                      <button type="button" className="at-btn at-btn--small at-btn--primary" onClick={() => void action.run(() => reviewCustomerOrder(tenantId, o.id, true, ''))}>
                        Confirmar
                      </button>
                      <button type="button" className="at-btn at-btn--small" onClick={() => void action.run(() => reviewCustomerOrder(tenantId, o.id, false, 'Recusado pelo atendimento'))}>
                        Recusar
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {ready.length ? (
          <section className="at-panel at-panel--ready" aria-labelledby="q-ready">
            <h2 id="q-ready">
              <Icon name="bell" size={16} /> Prontos para servir
            </h2>
            <ul className="at-list">
              {ready.map((o) => (
                <li key={o.id}>
                  <Link href={`${base}/atendimento/comanda/${o.tab_id}`}>
                    #{o.number} · {label(o.tab_id)}
                  </Link>
                  <span className="at-meta">{o.delivery_by === 'cozinha' ? 'Cozinha entrega' : `há ${minutesSince(o.ready_at ?? o.created_at)} min`}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    ) : null;

  const error = action.error ? <p className="at-error">{action.error.message}</p> : null;

  if (props.tables.length === 0) {
    return (
      <div className="at-empty">
        <Icon name="armchair" size={34} />
        <p>Nenhuma mesa cadastrada. A Gestão cadastra mesas e setores.</p>
        <Link className="at-btn at-btn--primary" href={`${base}/atendimento/balcao`}>
          Atender no balcão
        </Link>
      </div>
    );
  }

  if (model === 'm2') {
    const sel = props.tables.find((t) => t.id === selected) ?? null;
    const selTab = sel ? tabByTable.get(sel.id) : undefined;
    const selState = sel ? stateOf(selTab, props.orders) : null;
    const selOrders = selTab ? props.orders.filter((o) => o.tab_id === selTab.id) : [];
    return (
      <div className="at-map-layout">
        <div className="at-map">
          <div className="at-map-head">
            <h1>{sector === 'all' ? 'Salão' : (props.sectors.find((s) => s.id === sector)?.name ?? 'Salão')}</h1>
            {sectorTabs}
          </div>
          {summary}
          {error}
          <div className="at-floorplan">{visibleTables.map((t) => tableButton(t, 'map', () => setSelected(t.id)))}</div>
        </div>
        <aside className="at-map-side">
          {sel ? (
            <section className="at-panel at-mesa" data-state={selState ?? 'livre'}>
              <header>
                <h2>Mesa {sel.label}</h2>
                <span className="at-status-pill" data-state={selState ?? 'livre'}>
                  {STATE_LABEL[selState ?? 'livre']}
                </span>
              </header>
              <ul className="at-mesa-facts">
                <li>
                  <Icon name="users" size={15} /> {selTab?.guest_count ?? sel.seats} {selTab ? 'pessoas' : 'lugares'}
                </li>
                {selTab ? (
                  <>
                    <li>
                      <Icon name="clock" size={15} /> Aberta há {minutesSince(selTab.opened_at)} min
                    </li>
                    <li>
                      <Icon name="receipt" size={15} /> Comanda #{selTab.number} · {selOrders.length} pedidos ativos
                    </li>
                  </>
                ) : null}
              </ul>
              {selTab ? (
                <dl className="at-mesa-total">
                  <dt>Total</dt>
                  <dd>{formatCents(selTab.total_cents)}</dd>
                  <dt>Pago</dt>
                  <dd>{formatCents(selTab.paid_cents)}</dd>
                </dl>
              ) : null}
              <div className="at-mesa-actions">
                {selTab ? (
                  <Link className="at-btn at-btn--primary at-btn--block" href={`${base}/atendimento/comanda/${selTab.id}`}>
                    <Icon name="menu" size={16} /> Abrir comanda e pedir
                  </Link>
                ) : props.canOpen ? (
                  <button type="button" className="at-btn at-btn--primary at-btn--block" disabled={action.pending} onClick={() => open(sel)}>
                    <Icon name="plus" size={16} /> Abrir mesa
                  </button>
                ) : null}
              </div>
            </section>
          ) : (
            <section className="at-panel at-mesa at-mesa--empty">
              <Icon name="armchair" size={30} />
              <p>Toque em uma mesa para ver os detalhes.</p>
            </section>
          )}
          {queues}
        </aside>
      </div>
    );
  }

  if (model === 'm3') {
    return (
      <div className="at-split">
        <section className="at-panel" aria-labelledby="open-tabs">
          <header className="at-panel-head">
            <h2 id="open-tabs">Comandas em atendimento</h2>
            <span className="at-count">{props.tabs.length}</span>
          </header>
          {error}
          {props.tabs.length === 0 ? <p className="at-meta">Nenhuma comanda aberta.</p> : null}
          <ul className="at-tabcards">
            {props.tabs.map((tab) => {
              const st = stateOf(tab, props.orders);
              return (
                <li key={tab.id}>
                  <Link href={`${base}/atendimento/comanda/${tab.id}`} className="at-tabcard" data-state={st}>
                    <span className="at-tabcard-num">#{tab.number}</span>
                    <span className="at-tabcard-main">
                      <strong>{tab.table_id ? `Mesa ${tableLabel.get(tab.table_id)}` : (tab.customer_name ?? 'Balcão')}</strong>
                      <span className="at-meta">
                        {tab.guest_count ?? '—'} pessoas · {minutesSince(tab.opened_at)} min
                      </span>
                    </span>
                    <span className="at-tabcard-side">
                      <strong>{formatCents(tab.total_cents)}</strong>
                      <span className="at-status-pill" data-state={st}>
                        {STATE_LABEL[st]}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
        <div className="at-stack">
          {queues}
          <section className="at-panel" aria-labelledby="free-tables">
            <header className="at-panel-head">
              <h2 id="free-tables">Mesas</h2>
              {summary}
            </header>
            <div className="at-grid at-grid--compact">{props.tables.map((t) => tableButton(t, 'chip'))}</div>
          </section>
        </div>
      </div>
    );
  }

  if (model === 'm4') {
    const busy = props.tabs.filter((t) => t.table_id).length;
    return (
      <div className="at-premium-floor">
        <div className="at-premium-head">
          <div>
            <p className="at-eyebrow">Hospitalidade</p>
            <h1>Salão</h1>
            <p>
              {busy} de {props.tables.length} mesas ocupadas · {props.tabs.reduce((a, t) => a + (t.guest_count ?? 0), 0)} convidados
            </p>
          </div>
          {sectorTabs}
        </div>
        {error}
        {queues}
        <div className="at-grid at-grid--large">{visibleTables.map((t) => tableButton(t, 'tile'))}</div>
      </div>
    );
  }

  return (
    <div className="at-floor">
      <div className="at-floor-head">
        <div>
          <h1>Mesas</h1>
          <p className="at-meta">Toque em uma mesa livre para abrir a comanda.</p>
        </div>
        {sectorTabs}
      </div>
      {summary}
      {error}
      {queues}
      <div className="at-grid">{visibleTables.map((t) => tableButton(t, 'card'))}</div>
    </div>
  );
}
