import Link from 'next/link';
import type { VisualModel } from '@/core/apps';
import { config } from '@/core/config';
import { addDays, formatDate } from '@/core/dates';
import { formatCents } from '@/core/money';
import type { TenantContext } from '@/core/tenant/context';
import type { Kpis } from '@/apps/gestao/queries';
import { Bars, PageHead, Stat } from '@/apps/gestao/ui';

const CHANNEL: Record<string, string> = { salao: 'Salão', balcao: 'Balcão', delivery: 'Delivery' };

export function periodFromSearch(today: string, preset: string | undefined, from?: string, to?: string) {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (from && to && iso.test(from) && iso.test(to) && from <= to) return { from, to, preset: 'custom' };
  switch (preset) {
    case 'ontem':
      return { from: addDays(today, -1), to: addDays(today, -1), preset };
    case '7d':
      return { from: addDays(today, -6), to: today, preset };
    case '30d':
      return { from: addDays(today, -29), to: today, preset };
    case 'mes':
      return { from: `${today.slice(0, 8)}01`, to: today, preset };
    default:
      return { from: today, to: today, preset: 'hoje' };
  }
}

export function PeriodFilter({ base, path, current, from, to }: { base: string; path: string; current: string; from: string; to: string }) {
  const presets = [
    ['hoje', 'Hoje'],
    ['ontem', 'Ontem'],
    ['7d', '7 dias'],
    ['30d', '30 dias'],
    ['mes', 'Mês'],
  ];
  return (
    <div className="gs-row">
      <nav className="gs-tabs" aria-label="Período" style={{ margin: 0 }}>
        {presets.map(([key, label]) => (
          <Link key={key} href={`${base}${path}?periodo=${key}`} aria-current={current === key ? 'page' : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <form className="gs-row" action={`${base}${path}`}>
        <label className="sr-only" htmlFor="de">
          De
        </label>
        <input className="gs-input" style={{ width: 150 }} type="date" id="de" name="de" defaultValue={from} />
        <label className="sr-only" htmlFor="ate">
          Até
        </label>
        <input className="gs-input" style={{ width: 150 }} type="date" id="ate" name="ate" defaultValue={to} />
        <button className="gs-btn gs-btn--small" type="submit">
          Aplicar
        </button>
      </form>
    </div>
  );
}

export function Dashboard({
  ctx,
  kpis,
  base,
  preset,
  model,
}: {
  ctx: TenantContext;
  kpis: Kpis;
  base: string;
  preset: string;
  model: VisualModel;
}) {
  const p = kpis.pending;
  const pendencies = [
    { label: 'Comandas abertas', value: p.open_tabs, hint: p.open_tabs_previous_days ? `${p.open_tabs_previous_days} de dias anteriores` : undefined, href: null },
    { label: 'Saldo a receber em aberto', value: formatCents(p.receivable_open_cents), href: null },
    { label: 'Pedidos em produção', value: p.orders_in_production, href: null },
    { label: 'Prontos aguardando entrega', value: p.orders_ready, href: null },
    { label: 'Aguardando confirmação', value: p.orders_awaiting_confirmation, href: null },
    { label: 'Aprovações pendentes', value: p.approvals, href: `${base}/gestao/aprovacoes` },
    { label: 'Caixas abertos', value: p.open_cash_sessions, href: null },
    { label: 'Materiais abaixo do mínimo', value: p.low_stock, href: null },
    { label: 'Contas a vencer (7 dias)', value: formatCents(p.payables_due_cents), href: null },
  ];
  const onboardingPending = !ctx.tenant.onboarding_completed_at && ctx.membership.is_owner;

  return (
    <>
      {onboardingPending ? (
        <div className="gs-banner" role="status">
          <span>
            <strong>Primeiro acesso em andamento.</strong> Continue a configuração guiada do restaurante.
          </span>
          <a className="gs-btn gs-btn--small gs-btn--primary" href={config.pathTenants ? '/portal/boas-vindas' : `https://${config.rootDomain}/portal/boas-vindas`}>
            Continuar
          </a>
        </div>
      ) : null}
      <PageHead
        title={model === 'm2' ? `Bom trabalho, ${ctx.membership.display_name.split(' ')[0]}.` : 'Painel de Gestão'}
        subtitle={`Dia operacional ${formatDate(kpis.today)} · ${kpis.period.from === kpis.period.to ? formatDate(kpis.period.from) : `${formatDate(kpis.period.from)} a ${formatDate(kpis.period.to)}`}`}
        actions={<PeriodFilter base={base} path="/gestao" current={preset} from={kpis.period.from} to={kpis.period.to} />}
      />
      <section aria-label="Indicadores do período" className="gs-grid gs-grid--stats">
        <Stat label="Faturamento" value={formatCents(kpis.revenue_cents)} hint={kpis.refunded_cents ? `${formatCents(kpis.refunded_cents)} estornados` : undefined} />
        <Stat label="Comandas encerradas" value={kpis.closed_tabs} />
        <Stat label="Ticket médio" value={formatCents(kpis.avg_ticket_cents)} />
        <Stat label="Pedidos" value={kpis.orders} hint={`${kpis.cancelled_orders} cancelados/recusados`} />
        <Stat label="Tempo médio de preparo" value={`${kpis.avg_prep_minutes} min`} />
        <Stat label="Descontos concedidos" value={formatCents(kpis.discounts_cents)} />
      </section>
      <div className="gs-grid">
        <section className="gs-card" aria-labelledby="pend">
          <h2 id="pend" className="gs-h2">
            Pendências da operação
          </h2>
          <p className="gs-meta" style={{ margin: 0 }}>
            Estado real, inclusive o que foi iniciado em dias anteriores.
          </p>
          <ul className="gs-list">
            {pendencies.map((item) => (
              <li key={item.label}>
                <span>
                  {item.label}
                  {item.hint ? <span className="gs-meta"> · {item.hint}</span> : null}
                </span>
                {item.href ? (
                  <Link href={item.href}>
                    <strong>{item.value}</strong>
                  </Link>
                ) : (
                  <strong>{item.value}</strong>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="gs-card" aria-labelledby="dias">
          <h2 id="dias" className="gs-h2">
            Faturamento por dia
          </h2>
          <Bars items={kpis.by_day.map((d) => ({ label: formatDate(d.day).slice(0, 5), value: d.total_cents }))} format={formatCents} />
        </section>
        <section className="gs-card" aria-labelledby="metodos">
          <h2 id="metodos" className="gs-h2">
            Recebimentos por forma
          </h2>
          {kpis.by_method.length ? (
            <Bars items={kpis.by_method.map((m) => ({ label: m.name, value: m.total_cents }))} format={formatCents} />
          ) : (
            <p className="gs-meta">Sem recebimentos no período.</p>
          )}
          <h3 className="gs-h2" style={{ fontSize: '0.95rem' }}>
            Por canal
          </h3>
          <Bars
            items={Object.entries(kpis.by_channel).map(([k, v]) => ({ label: CHANNEL[k] ?? k, value: v }))}
            format={formatCents}
          />
        </section>
        <section className="gs-card" aria-labelledby="top">
          <h2 id="top" className="gs-h2">
            Produtos mais vendidos
          </h2>
          {kpis.top_products.length ? (
            <ol className="gs-list">
              {kpis.top_products.map((t) => (
                <li key={t.name}>
                  <span>{t.name}</span>
                  <span className="gs-meta">
                    {t.quantity} un · {formatCents(t.total_cents)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="gs-meta">Sem vendas no período.</p>
          )}
        </section>
      </div>
    </>
  );
}
