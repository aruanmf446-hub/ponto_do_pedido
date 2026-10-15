import Link from 'next/link';
import type { VisualModel } from '@/core/apps';
import { formatCents } from '@/core/money';
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

/** Visão geral: a mesma informação com composições próprias para cada modelo. */
export function Overview({ data, model, base }: { data: Data; model: VisualModel; base: string }) {
  const overdue = data.payables.filter((p) => p.due_date < data.today);
  const dueToday = data.payables.filter((p) => p.due_date === data.today);
  const sum = (list: { amount_cents: number }[]) => list.reduce((a, p) => a + Number(p.amount_cents), 0);
  const flowNet = data.flow.reduce((a, d) => a + Number(d.net_cents), 0);
  const stats = (
    <div className="fn-stats">
      <Stat label="Vencidas" value={formatCents(sum(overdue))} tone={overdue.length ? 'danger' : undefined} />
      <Stat label="Vencem hoje" value={formatCents(sum(dueToday))} tone={dueToday.length ? 'warn' : undefined} />
      <Stat label="A pagar (30 dias)" value={formatCents(sum(data.payables))} />
      <Stat label="A receber" value={formatCents(sum(data.receivables))} />
      <Stat label="Saldo 14 dias" value={formatCents(flowNet)} tone={flowNet >= 0 ? 'ok' : 'danger'} />
    </div>
  );
  const queue = (
    <ul className="fn-queue-list">
      {data.purchases.map((p) => (
        <li key={p.id}>
          <Link href={`${base}/financeiro/compras#pr-${p.id}`}>
            <Badge tone={statusTone(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Badge> Compra nº {p.number} — {p.justification}
          </Link>
        </li>
      ))}
      {data.reimbursements.map((r) => (
        <li key={r.id}>
          <Link href={`${base}/financeiro/reembolsos`}>
            <Badge tone="warn">Reembolso</Badge> {r.description} · {formatCents(r.amount_cents)}
          </Link>
        </li>
      ))}
      {data.supplies.map((s) => (
        <li key={s.id}>
          <Link href={`${base}/financeiro/suprimentos`}>
            <Badge tone="accent">Suprimento</Badge> Solicitação de material nº {s.number}
          </Link>
        </li>
      ))}
      {[...overdue, ...dueToday].map((p) => (
        <li key={p.id}>
          <Link href={`${base}/financeiro/pagar#p-${p.id}`}>
            <Badge tone={p.due_date < data.today ? 'danger' : 'warn'}>{p.due_date < data.today ? 'Vencida' : 'Hoje'}</Badge> {p.description} · {formatCents(p.amount_cents)}
          </Link>
        </li>
      ))}
    </ul>
  );
  const queueSize = data.purchases.length + data.reimbursements.length + data.supplies.length + overdue.length + dueToday.length;
  const ledger = (
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
            <th className="fn-num">{formatCents(data.flow.reduce((a, d) => a + Number(d.sales_cents), 0))}</th>
            <th className="fn-num">{formatCents(data.flow.reduce((a, d) => a + Number(d.in_cents), 0))}</th>
            <th className="fn-num">{formatCents(data.flow.reduce((a, d) => a + Number(d.out_cents), 0))}</th>
            <th className="fn-num">{formatCents(flowNet)}</th>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  if (model === 'm1') {
    const folders = [
      { href: '/financeiro/compras', label: 'Compras', count: data.purchases.length },
      { href: '/financeiro/pagar', label: 'Contas a pagar', count: data.payables.length },
      { href: '/financeiro/receber', label: 'Contas a receber', count: data.receivables.length },
      { href: '/financeiro/reembolsos', label: 'Reembolsos', count: data.reimbursements.length },
      { href: '/financeiro/suprimentos', label: 'Suprimentos', count: data.supplies.length },
      { href: '/financeiro/documentos', label: 'Documentos', count: data.documents.length },
    ];
    return (
      <div className="fn-stack">
        <PageHead title="Escritório" subtitle="Cada processo em sua pasta; abra para conferir e decidir." />
        <div className="fn-folders">
          {folders.map((f) => (
            <Link key={f.href} href={`${base}${f.href}`} className="fn-folder">
              <span className="fn-folder-tab" aria-hidden="true" />
              <strong>{f.label}</strong>
              <span>{f.count} em aberto</span>
            </Link>
          ))}
        </div>
        <div className="fn-split">
          <Panel title="Documentos recentes">
            {data.documents.length === 0 ? (
              <Empty>Nenhum documento arquivado.</Empty>
            ) : (
              <ul className="fn-list">
                {data.documents.map((d) => (
                  <li key={d.id}>
                    <span>{d.title}</span>
                    <Badge>{DOC_KINDS[d.kind] ?? d.kind}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Pendências">{queueSize ? queue : <Empty>Nada aguardando decisão.</Empty>}</Panel>
        </div>
        {stats}
      </div>
    );
  }

  if (model === 'm2') {
    return (
      <div className="fn-stack">
        <PageHead title={`Fila de decisões (${queueSize})`} subtitle="Aprovar, pagar e autorizar sem sair do console." />
        <div className="fn-console">
          <Panel title="Aguardando você" className="fn-console-queue">
            {queueSize ? queue : <Empty>Fila vazia. Tudo em dia.</Empty>}
          </Panel>
          <div className="fn-stack">{stats}</div>
        </div>
      </div>
    );
  }

  if (model === 'm3') {
    return (
      <div className="fn-stack">
        <PageHead title="Razão dos últimos 14 dias" subtitle="Vendas do Caixa por dia operacional + lançamentos financeiros." />
        {stats}
        <Panel>{ledger}</Panel>
        <Panel title="Pendências">{queueSize ? queue : <Empty>Nada aguardando decisão.</Empty>}</Panel>
      </div>
    );
  }

  // m4 — agenda: vencimentos e recebimentos em linha do tempo
  const events = [
    ...data.payables.map((p) => ({ id: p.id, day: p.due_date, kind: 'out' as const, label: p.description, amount: p.amount_cents, href: `/financeiro/pagar#p-${p.id}` })),
    ...data.receivables.map((r) => ({ id: r.id, day: r.due_date, kind: 'in' as const, label: `${r.customer_name} — ${r.description}`, amount: r.amount_cents, href: '/financeiro/receber' })),
  ].sort((a, b) => a.day.localeCompare(b.day));
  const days = [...new Set(events.map((e) => e.day))];
  return (
    <div className="fn-stack">
      <PageHead title="Agenda" subtitle="O que entra e sai, dia a dia." />
      {stats}
      <div className="fn-agenda">
        {days.length === 0 ? <Empty>Nenhum vencimento nos próximos 30 dias.</Empty> : null}
        {days.map((day) => (
          <section key={day} className="fn-agenda-day" data-overdue={day < data.today} data-today={day === data.today}>
            <h2 className="fn-agenda-date">{day === data.today ? 'Hoje' : fmtDay(day)}</h2>
            <ul>
              {events
                .filter((e) => e.day === day)
                .map((e) => (
                  <li key={e.id} data-kind={e.kind}>
                    <Link href={`${base}${e.href}`}>
                      <span>{e.label}</span>
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
      {queueSize ? <Panel title="Decisões pendentes">{queue}</Panel> : null}
    </div>
  );
}
