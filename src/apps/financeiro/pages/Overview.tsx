import Link from 'next/link';
import type { VisualModel } from '@/core/apps';
import { formatCents } from '@/core/money';
import { Icon, type IconName } from '@/core/ui/Icon';
import type { FlowDay, Payable, Receivable } from '@/apps/financeiro/queries';
import { Badge, DOC_KINDS, Empty, PageHead, Panel, Stat, STATUS_LABEL, fmtDay, statusTone } from '@/apps/financeiro/ui';

type Data = {
  today: string;
  payables: Payable[];
  receivables: Receivable[];
  purchases: { id: string; number: number; status: string; justification: string; requested_at: string }[];
  reimbursements: { id: string; description: string; amount_cents: number; created_at: string }[];
  supplies: { id: string; number: number; requested_at: string }[];
  documents: { id: string; kind: string; title: string; created_at: string }[];
  flow: FlowDay[];
};

type Decision = { id: string; kind: string; icon: IconName; label: string; amount: number | null; status: string; tone: 'ok' | 'warn' | 'danger' | 'accent' | undefined; href: string; date: string };

const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Visão geral: a mesma informação com composições próprias para cada modelo. */
export function Overview({ data, model, base }: { data: Data; model: VisualModel; base: string }) {
  const overdue = data.payables.filter((p) => p.due_date < data.today);
  const dueToday = data.payables.filter((p) => p.due_date === data.today);
  const sum = (list: { amount_cents: number }[]) => list.reduce((a, p) => a + Number(p.amount_cents), 0);
  const flowNet = data.flow.reduce((a, d) => a + Number(d.net_cents), 0);
  const sales = data.flow.reduce((a, d) => a + Number(d.sales_cents), 0);

  const decisions: Decision[] = [
    ...[...overdue, ...dueToday].map((p) => ({
      id: p.id,
      kind: 'Conta a pagar',
      icon: 'arrow-up-right' as IconName,
      label: p.description,
      amount: Number(p.amount_cents),
      status: p.due_date < data.today ? 'Vencida' : 'Vence hoje',
      tone: (p.due_date < data.today ? 'danger' : 'warn') as Decision['tone'],
      href: `/financeiro/pagar#p-${p.id}`,
      date: p.due_date,
    })),
    ...data.purchases.map((p) => ({
      id: p.id,
      kind: 'Compra',
      icon: 'bag' as IconName,
      label: `Nº ${p.number} — ${p.justification}`,
      amount: null,
      status: STATUS_LABEL[p.status] ?? p.status,
      tone: statusTone(p.status),
      href: `/financeiro/compras#pr-${p.id}`,
      date: p.requested_at.slice(0, 10),
    })),
    ...data.reimbursements.map((r) => ({
      id: r.id,
      kind: 'Reembolso',
      icon: 'undo' as IconName,
      label: r.description,
      amount: Number(r.amount_cents),
      status: 'Solicitado',
      tone: 'warn' as const,
      href: '/financeiro/reembolsos',
      date: r.created_at.slice(0, 10),
    })),
    ...data.supplies.map((s) => ({
      id: s.id,
      kind: 'Suprimento',
      icon: 'boxes' as IconName,
      label: `Solicitação de material nº ${s.number}`,
      amount: null,
      status: 'Solicitado',
      tone: 'accent' as const,
      href: '/financeiro/suprimentos',
      date: s.requested_at.slice(0, 10),
    })),
  ];

  const stats = (
    <div className="fn-stats">
      <Stat icon="alert" label="Vencidas" value={formatCents(sum(overdue))} tone={overdue.length ? 'danger' : undefined} hint={`${overdue.length} conta(s)`} />
      <Stat icon="clock" label="Vencem hoje" value={formatCents(sum(dueToday))} tone={dueToday.length ? 'warn' : undefined} hint={`${dueToday.length} conta(s)`} />
      <Stat icon="arrow-up-right" label="A pagar (30 dias)" value={formatCents(sum(data.payables))} hint={`${data.payables.length} lançamento(s)`} />
      <Stat icon="coins" label="A receber" value={formatCents(sum(data.receivables))} hint={`${data.receivables.length} título(s)`} />
      <Stat icon="wallet" label="Resultado 14 dias" value={formatCents(flowNet)} tone={flowNet >= 0 ? 'ok' : 'danger'} hint={`Vendas ${formatCents(sales)}`} />
    </div>
  );

  const queueList = (
    <ul className="fn-queue-list">
      {decisions.map((d) => (
        <li key={`${d.kind}-${d.id}`}>
          <Link href={`${base}${d.href}`}>
            <span className="fn-queue-icon">
              <Icon name={d.icon} size={16} />
            </span>
            <span className="fn-queue-text">
              <strong>{d.label}</strong>
              <small>{d.kind}</small>
            </span>
            {d.amount != null ? <span className="fn-queue-amount">{formatCents(d.amount)}</span> : null}
            <Badge tone={d.tone}>{d.status}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );

  const maxDay = Math.max(1, ...data.flow.map((d) => Math.max(Number(d.sales_cents) + Number(d.in_cents), Number(d.out_cents))));
  const chart = (
    <div className="fn-chart" role="img" aria-label={`Vendas e saídas dos últimos ${data.flow.length} dias`}>
      {data.flow.map((d) => {
        const date = new Date(`${d.day}T12:00:00Z`);
        return (
          <div key={d.day} className="fn-chart-col" title={`${fmtDay(d.day)} · entradas ${formatCents(Number(d.sales_cents) + Number(d.in_cents))} · saídas ${formatCents(d.out_cents)}`}>
            <span className="fn-chart-bars">
              <span className="fn-chart-in" style={{ height: `${((Number(d.sales_cents) + Number(d.in_cents)) / maxDay) * 100}%` }} />
              <span className="fn-chart-out" style={{ height: `${(Number(d.out_cents) / maxDay) * 100}%` }} />
            </span>
            <span className="fn-chart-label">{String(date.getUTCDate()).padStart(2, '0')}</span>
          </div>
        );
      })}
    </div>
  );

  const upcoming = data.payables.filter((p) => p.due_date >= data.today).slice(0, 6);
  const upcomingList = upcoming.length ? (
    <ul className="fn-due-list">
      {upcoming.map((p) => (
        <li key={p.id}>
          <span className="fn-due-date">
            <b>{p.due_date.slice(8, 10)}</b>
            <small>{WEEKDAY[new Date(`${p.due_date}T12:00:00Z`).getUTCDay()]}</small>
          </span>
          <span className="fn-due-text">
            <strong>{p.description}</strong>
            <small>{p.supplier?.name ?? p.category ?? 'Conta'}</small>
          </span>
          <span className="fn-due-amount">{formatCents(p.amount_cents)}</span>
        </li>
      ))}
    </ul>
  ) : (
    <Empty>Nenhum vencimento futuro nos próximos 30 dias.</Empty>
  );

  // ---------- m2 · Agenda ----------
  if (model === 'm2') {
    const events = [
      ...data.payables.map((p) => ({ id: p.id, day: p.due_date, kind: 'out' as const, label: p.description, sub: p.supplier?.name ?? p.category ?? 'Conta a pagar', amount: p.amount_cents, href: `/financeiro/pagar#p-${p.id}` })),
      ...data.receivables.map((r) => ({ id: r.id, day: r.due_date, kind: 'in' as const, label: r.description, sub: r.customer_name, amount: r.amount_cents, href: '/financeiro/receber' })),
    ].sort((a, b) => a.day.localeCompare(b.day));
    const days = [...new Set(events.map((e) => e.day))];
    const week = Array.from({ length: 7 }, (_, i) => addDays(data.today, i));
    return (
      <div className="fn-stack">
        <PageHead title="Agenda financeira" subtitle="O que entra e sai, dia a dia, nos próximos 30 dias." />
        <div className="fn-week" aria-label="Próximos 7 dias">
          {week.map((day) => {
            const list = events.filter((e) => e.day === day);
            const out = list.filter((e) => e.kind === 'out').reduce((a, e) => a + Number(e.amount), 0);
            const inn = list.filter((e) => e.kind === 'in').reduce((a, e) => a + Number(e.amount), 0);
            return (
              <div key={day} className="fn-week-day" data-today={day === data.today} data-busy={list.length > 0}>
                <span className="fn-week-name">{day === data.today ? 'Hoje' : WEEKDAY[new Date(`${day}T12:00:00Z`).getUTCDay()]}</span>
                <span className="fn-week-num">{day.slice(8, 10)}</span>
                {out ? <span className="fn-week-out">− {formatCents(out)}</span> : null}
                {inn ? <span className="fn-week-in">+ {formatCents(inn)}</span> : null}
                {!list.length ? <span className="fn-week-free">livre</span> : null}
              </div>
            );
          })}
        </div>
        <div className="fn-agenda-layout">
          <div className="fn-agenda">
            {overdue.length ? (
              <section className="fn-agenda-day" data-overdue="true">
                <h2 className="fn-agenda-date">
                  <Icon name="alert" size={16} /> Em atraso
                </h2>
                <ul>
                  {overdue.map((p) => (
                    <li key={p.id} data-kind="out">
                      <Link href={`${base}/financeiro/pagar#p-${p.id}`}>
                        <span className="fn-agenda-text">
                          <span>{p.description}</span>
                          <small>venceu em {fmtDay(p.due_date)}</small>
                        </span>
                        <strong>− {formatCents(p.amount_cents)}</strong>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {days.filter((d) => d >= data.today).length === 0 ? <Empty>Nenhum vencimento nos próximos 30 dias.</Empty> : null}
            {days
              .filter((d) => d >= data.today)
              .map((day) => (
                <section key={day} className="fn-agenda-day" data-today={day === data.today}>
                  <h2 className="fn-agenda-date">
                    <span className="fn-agenda-num">{day.slice(8, 10)}</span>
                    <span>{day === data.today ? 'Hoje' : `${WEEKDAY[new Date(`${day}T12:00:00Z`).getUTCDay()]} · ${fmtDay(day)}`}</span>
                  </h2>
                  <ul>
                    {events
                      .filter((e) => e.day === day)
                      .map((e) => (
                        <li key={e.id} data-kind={e.kind}>
                          <Link href={`${base}${e.href}`}>
                            <span className="fn-agenda-ico">
                              <Icon name={e.kind === 'in' ? 'coins' : 'arrow-up-right'} size={16} />
                            </span>
                            <span className="fn-agenda-text">
                              <span>{e.label}</span>
                              <small>{e.sub}</small>
                            </span>
                            <strong>
                              {e.kind === 'in' ? '+' : '−'} {formatCents(e.amount)}
                            </strong>
                          </Link>
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
          </div>
          <aside className="fn-stack">
            <Panel title="Resumo">
              <dl className="fn-summary">
                <dt>A pagar (30 dias)</dt>
                <dd>{formatCents(sum(data.payables))}</dd>
                <dt>A receber</dt>
                <dd>{formatCents(sum(data.receivables))}</dd>
                <dt>Em atraso</dt>
                <dd data-tone={overdue.length ? 'danger' : undefined}>{formatCents(sum(overdue))}</dd>
                <dt>Resultado 14 dias</dt>
                <dd data-tone={flowNet >= 0 ? 'ok' : 'danger'}>{formatCents(flowNet)}</dd>
              </dl>
            </Panel>
            <Panel title={`Decisões pendentes (${decisions.length})`}>{decisions.length ? queueList : <Empty>Nada aguardando decisão.</Empty>}</Panel>
          </aside>
        </div>
      </div>
    );
  }

  // ---------- m3 · Escritório contábil por documentos ----------
  if (model === 'm3') {
    const folders: { href: string; label: string; count: number; icon: IconName }[] = [
      { href: '/financeiro/compras', label: 'Compras', count: data.purchases.length, icon: 'bag' },
      { href: '/financeiro/pagar', label: 'Contas a pagar', count: data.payables.length, icon: 'arrow-up-right' },
      { href: '/financeiro/receber', label: 'Contas a receber', count: data.receivables.length, icon: 'coins' },
      { href: '/financeiro/reembolsos', label: 'Reembolsos', count: data.reimbursements.length, icon: 'undo' },
      { href: '/financeiro/suprimentos', label: 'Suprimentos', count: data.supplies.length, icon: 'boxes' },
      { href: '/financeiro/documentos', label: 'Documentos', count: data.documents.length, icon: 'file' },
    ];
    return (
      <div className="fn-stack">
        <PageHead
          title="Escritório contábil"
          subtitle="Cada processo em sua pasta; o documento é a origem de cada lançamento."
          actions={
            <Link href={`${base}/financeiro/documentos`} className="fn-btn fn-btn--primary">
              <Icon name="file" size={16} /> Arquivar documento
            </Link>
          }
        />
        <div className="fn-folders">
          {folders.map((f) => (
            <Link key={f.href} href={`${base}${f.href}`} className="fn-folder">
              <span className="fn-folder-icon">
                <Icon name="folder" size={26} />
              </span>
              <strong>{f.label}</strong>
              <span>
                {f.count} {f.label === 'Documentos' ? 'arquivado(s)' : 'em aberto'}
              </span>
            </Link>
          ))}
        </div>
        <div className="fn-split">
          <Panel title="Documentos recentes">
            {data.documents.length === 0 ? (
              <Empty>Nenhum documento arquivado.</Empty>
            ) : (
              <ul className="fn-doc-list">
                {data.documents.map((d) => (
                  <li key={d.id}>
                    <span className="fn-doc-icon">
                      <Icon name="file" size={18} />
                    </span>
                    <span className="fn-doc-text">
                      <strong>{d.title}</strong>
                      <small>{fmtDay(d.created_at)}</small>
                    </span>
                    <Badge>{DOC_KINDS[d.kind] ?? d.kind}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Pendências">{decisions.length ? queueList : <Empty>Nada aguardando decisão.</Empty>}</Panel>
        </div>
        <Panel title="Razão dos últimos 14 dias">
          <div className="fn-table-wrap">
            <table className="fn-table">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th className="fn-num">Vendas</th>
                  <th className="fn-num">Entradas</th>
                  <th className="fn-num">Saídas</th>
                  <th className="fn-num">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {data.flow.map((d) => (
                  <tr key={d.day}>
                    <td>{fmtDay(d.day)}</td>
                    <td className="fn-num">{formatCents(d.sales_cents)}</td>
                    <td className="fn-num">{formatCents(d.in_cents)}</td>
                    <td className="fn-num">{formatCents(d.out_cents)}</td>
                    <td className="fn-num" data-negative={d.net_cents < 0}>
                      {formatCents(d.net_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th className="fn-num">{formatCents(sales)}</th>
                  <th className="fn-num">{formatCents(data.flow.reduce((a, d) => a + Number(d.in_cents), 0))}</th>
                  <th className="fn-num">{formatCents(data.flow.reduce((a, d) => a + Number(d.out_cents), 0))}</th>
                  <th className="fn-num">{formatCents(flowNet)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </Panel>
      </div>
    );
  }

  // ---------- m4 · Console de aprovações e pagamentos ----------
  if (model === 'm4') {
    const counts = [
      { label: 'Vencidas', value: overdue.length, tone: 'danger', icon: 'alert' as IconName },
      { label: 'Vencem hoje', value: dueToday.length, tone: 'warn', icon: 'clock' as IconName },
      { label: 'Compras', value: data.purchases.length, tone: 'accent', icon: 'bag' as IconName },
      { label: 'Reembolsos', value: data.reimbursements.length, tone: 'accent', icon: 'undo' as IconName },
      { label: 'Suprimentos', value: data.supplies.length, tone: 'accent', icon: 'boxes' as IconName },
    ];
    return (
      <div className="fn-stack">
        <PageHead title="Fila de decisões" subtitle="Aprovar, pagar e autorizar em um só lugar. Cada ação abre o processo com a autorização correspondente." />
        <div className="fn-counters">
          {counts.map((c) => (
            <div key={c.label} className="fn-counter" data-tone={c.tone}>
              <Icon name={c.icon} size={18} />
              <b>{c.value}</b>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
        <Panel>
          {decisions.length === 0 ? (
            <Empty>Fila vazia. Tudo em dia.</Empty>
          ) : (
            <div className="fn-table-wrap">
              <table className="fn-table fn-table--console">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th>Data</th>
                    <th className="fn-num">Valor</th>
                    <th>Situação</th>
                    <th aria-label="Ação" />
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((d) => (
                    <tr key={`${d.kind}-${d.id}`} data-tone={d.tone}>
                      <td>
                        <span className="fn-type">
                          <Icon name={d.icon} size={15} /> {d.kind}
                        </span>
                      </td>
                      <td>{d.label}</td>
                      <td>{fmtDay(d.date)}</td>
                      <td className="fn-num">{d.amount != null ? formatCents(d.amount) : '—'}</td>
                      <td>
                        <Badge tone={d.tone}>{d.status}</Badge>
                      </td>
                      <td>
                        <Link href={`${base}${d.href}`} className="fn-btn fn-btn--small">
                          {d.kind === 'Conta a pagar' ? 'Pagar' : 'Decidir'} <Icon name="arrow-right" size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        {stats}
      </div>
    );
  }

  // ---------- m1 · Painel executivo ----------
  return (
    <div className="fn-stack">
      <PageHead title="Painel financeiro" subtitle="Saúde financeira do restaurante: o que entrou, o que vence e o que aguarda decisão." />
      {stats}
      <div className="fn-exec">
        <Panel title="Entradas × saídas · 14 dias" className="fn-exec-chart">
          {chart}
          <div className="fn-chart-legend">
            <span data-kind="in">Entradas (vendas + recebimentos)</span>
            <span data-kind="out">Saídas</span>
          </div>
        </Panel>
        <Panel title="Próximos vencimentos" actions={<Link href={`${base}/financeiro/pagar`} className="fn-link">Ver contas</Link>}>
          {upcomingList}
        </Panel>
      </div>
      <Panel title={`Pendências (${decisions.length})`}>{decisions.length ? queueList : <Empty>Nada aguardando decisão.</Empty>}</Panel>
    </div>
  );
}
