'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { minutesSince } from '@/core/dates';
import { formatCents } from '@/core/money';
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

export function Floor(props: Props) {
  const { model, base, tenantId } = useTenant();
  const router = useRouter();
  const action = useAction();
  const tabByTable = new Map(props.tabs.filter((t) => t.table_id).map((t) => [t.table_id as string, t]));
  const pending = props.orders.filter((o) => o.status === 'pending_confirmation');
  const ready = props.orders.filter((o) => o.status === 'ready');
  const tabNumber = new Map(props.tabs.map((t) => [t.id, t]));
  const tableLabel = new Map(props.tables.map((t) => [t.id, t.label]));
  const label = (tabId: string) => {
    const tab = tabNumber.get(tabId);
    return tab?.table_id ? `Mesa ${tableLabel.get(tab.table_id)}` : `Comanda #${tab?.number ?? ''}`;
  };

  const go = (table: FloorTable) => {
    const tab = tabByTable.get(table.id);
    if (tab) return router.push(`${base}/atendimento/comanda/${tab.id}`);
    if (!props.canOpen) return;
    void action.run(() => openTab(tenantId, table.id, '', null, newIdempotencyKey('tab')), {
      refresh: false,
      onSuccess: (t) => router.push(`${base}/atendimento/comanda/${t.id}`),
    });
  };

  const tableButton = (t: FloorTable, variant: string) => {
    const tab = tabByTable.get(t.id);
    const st = stateOf(tab, props.orders);
    return (
      <button key={t.id} type="button" className={`at-table at-table--${variant}`} data-state={st} onClick={() => go(t)} disabled={action.pending}>
        <span className="at-table-label">{t.label}</span>
        <span className="at-table-state">{STATE_LABEL[st]}</span>
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

  const queues = (
    <div className="at-queues">
      {pending.length ? (
        <section className="at-panel" aria-labelledby="q-confirm">
          <h2 id="q-confirm">Pedidos do QR Code para confirmar</h2>
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
          <h2 id="q-ready">Prontos para retirar</h2>
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
  );

  const error = action.error ? <p className="at-error">{action.error.message}</p> : null;

  if (props.tables.length === 0) {
    return (
      <div className="at-empty">
        <p>Nenhuma mesa cadastrada. A Gestão cadastra mesas e setores.</p>
        <Link className="at-btn" href={`${base}/atendimento/balcao`}>
          Atender no balcão
        </Link>
      </div>
    );
  }

  if (model === 'm2') {
    const bySector = [...props.sectors, { id: '', name: 'Sem setor' }].map((s) => ({
      ...s,
      tables: props.tables.filter((t) => (t.sector_id ?? '') === s.id),
    }));
    return (
      <div className="at-map-layout">
        <div className="at-map">
          <div className="at-legend" aria-hidden="true">
            {(['livre', 'ocupada', 'confirmar', 'pronto', 'conta'] as TableState[]).map((s) => (
              <span key={s} data-state={s}>
                {STATE_LABEL[s]}
              </span>
            ))}
          </div>
          {error}
          {bySector
            .filter((s) => s.tables.length)
            .map((s) => (
              <section key={s.id || 'none'} className="at-sector" aria-label={s.name}>
                <h2>{s.name}</h2>
                <div className="at-sector-floor">{s.tables.map((t) => tableButton(t, 'round'))}</div>
              </section>
            ))}
        </div>
        <aside className="at-map-side">{queues}</aside>
      </div>
    );
  }

  if (model === 'm3') {
    const tabsSorted = props.tabs;
    return (
      <div className="at-split">
        <section className="at-panel" aria-labelledby="open-tabs">
          <h2 id="open-tabs">Comandas em atendimento ({tabsSorted.length})</h2>
          {error}
          <table className="at-table-list">
            <thead>
              <tr>
                <th>Comanda</th>
                <th>Mesa</th>
                <th>Situação</th>
                <th className="at-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {tabsSorted.map((tab) => (
                <tr key={tab.id} data-state={stateOf(tab, props.orders)}>
                  <td>
                    <Link href={`${base}/atendimento/comanda/${tab.id}`}>#{tab.number}</Link>
                  </td>
                  <td>{tab.table_id ? tableLabel.get(tab.table_id) : (tab.customer_name ?? 'Balcão')}</td>
                  <td>{STATE_LABEL[stateOf(tab, props.orders)]}</td>
                  <td className="at-num">{formatCents(tab.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {queues}
        </section>
        <section className="at-panel" aria-labelledby="free-tables">
          <h2 id="free-tables">Mesas</h2>
          <div className="at-grid at-grid--compact">{props.tables.map((t) => tableButton(t, 'chip'))}</div>
        </section>
      </div>
    );
  }

  if (model === 'm4') {
    return (
      <div className="at-premium-floor">
        <div className="at-premium-head">
          <h1>Salão</h1>
          <p>
            {props.tabs.filter((t) => t.table_id).length} de {props.tables.length} mesas ocupadas
          </p>
        </div>
        {error}
        {queues}
        <div className="at-grid at-grid--large">{props.tables.map((t) => tableButton(t, 'tile'))}</div>
      </div>
    );
  }

  return (
    <div className="at-floor">
      <div className="at-floor-head">
        <h1>Mesas</h1>
        <div className="at-row at-legend" aria-hidden="true">
          {(['livre', 'ocupada', 'confirmar', 'pronto', 'conta'] as TableState[]).map((s) => (
            <span key={s} data-state={s}>
              {STATE_LABEL[s]}
            </span>
          ))}
        </div>
      </div>
      {error}
      {queues}
      <div className="at-grid">{props.tables.map((t) => tableButton(t, 'card'))}</div>
    </div>
  );
}
