import Link from 'next/link';
import type { VisualModel } from '@/core/apps';
import { config } from '@/core/config';
import { addDays, formatDate } from '@/core/dates';
import { formatCents } from '@/core/money';
import type { TenantContext } from '@/core/tenant/context';
import { FoodArt } from '@/core/ui/FoodArt';
import { Icon, type IconName } from '@/core/ui/Icon';
import type { DashboardExtras, Kpis } from '@/apps/gestao/queries';
import { ACTIONS } from '@/apps/gestao/pages/History';
import { Badge, Bars, Columns, Donut, Empty, PageHead, Stat } from '@/apps/gestao/ui';

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

const MODULES: { key: string; label: string; icon: IconName; path: string }[] = [
  { key: 'atendimento', label: 'Atendimento', icon: 'service', path: '/atendimento' },
  { key: 'caixa', label: 'Caixa', icon: 'wallet', path: '/caixa' },
  { key: 'cozinha', label: 'Cozinha', icon: 'chef', path: '/cozinha' },
  { key: 'financeiro', label: 'Financeiro', icon: 'bank', path: '/financeiro' },
  { key: 'estoque', label: 'Estoque', icon: 'boxes', path: '/estoque' },
  { key: 'cardapio', label: 'Cardápio Digital', icon: 'qr', path: '/cardapio' },
  { key: 'delivery', label: 'Delivery', icon: 'truck', path: '/delivery' },
];

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(new Date().toISOString()) - Date.parse(iso)) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

/** Ilustração editorial (traço) desenhada para o Workspace Editorial. */
function EditorialArt() {
  return (
    <svg className="gs-hero-art" viewBox="0 0 320 180" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="210" cy="104" r="58" />
        <circle cx="210" cy="104" r="42" opacity=".6" />
        <path d="M128 52v96M120 52v24a8 8 0 0 0 16 0V52M292 52c-12 8-12 40 0 48v48" />
        <path d="M30 150c30-40 60-58 96-62M52 120c10-16 22-22 34-24M40 136c-6-14-2-26 8-34" opacity=".7" />
        <path d="M188 92c8-10 22-12 32-4M196 118c10 6 22 6 30-2" opacity=".7" />
        <circle cx="200" cy="104" r="5" />
        <circle cx="222" cy="98" r="3" />
      </g>
      <text x="40" y="44" className="gs-hero-script">Pessoas · Organização · Resultados</text>
    </svg>
  );
}

export function Dashboard({
  ctx,
  kpis,
  extras,
  base,
  preset,
  model,
}: {
  ctx: TenantContext;
  kpis: Kpis;
  extras: DashboardExtras;
  base: string;
  preset: string;
  model: VisualModel;
}) {
  const p = kpis.pending;
  const firstName = ctx.membership.display_name.split(' ')[0];
  const periodText = kpis.period.from === kpis.period.to ? formatDate(kpis.period.from) : `${formatDate(kpis.period.from)} a ${formatDate(kpis.period.to)}`;
  const pendencies: { label: string; value: string | number; icon: IconName; alert: boolean; href?: string }[] = [
    { label: 'Comandas abertas', value: p.open_tabs, icon: 'receipt', alert: p.open_tabs_previous_days > 0 },
    { label: 'Pedidos em produção', value: p.orders_in_production, icon: 'chef', alert: false },
    { label: 'Prontos aguardando entrega', value: p.orders_ready, icon: 'service', alert: p.orders_ready > 0 },
    { label: 'Aguardando confirmação', value: p.orders_awaiting_confirmation, icon: 'clock', alert: p.orders_awaiting_confirmation > 0 },
    { label: 'Aprovações pendentes', value: p.approvals, icon: 'approvals', alert: p.approvals > 0, href: `${base}/gestao/aprovacoes` },
    { label: 'Caixas abertos', value: p.open_cash_sessions, icon: 'wallet', alert: false },
    { label: 'Materiais abaixo do mínimo', value: p.low_stock, icon: 'boxes', alert: p.low_stock > 0 },
    { label: 'Contas a vencer (7 dias)', value: formatCents(p.payables_due_cents), icon: 'calendar', alert: p.payables_due_cents > 0 },
    { label: 'Saldo a receber em aberto', value: formatCents(p.receivable_open_cents), icon: 'coins', alert: false },
  ];
  const alerts = pendencies.filter((x) => x.alert).length;
  const onboardingPending = !ctx.tenant.onboarding_completed_at && ctx.membership.is_owner;
  const days = kpis.by_day.map((d) => ({ label: formatDate(d.day).slice(0, 5), value: d.total_cents }));
  const plan = ctx.tenant.plan_code ? ctx.tenant.plan_code.toUpperCase() : '—';
  const license = ctx.tenant.license_valid_until ? `até ${formatDate(ctx.tenant.license_valid_until)}` : 'sem vencimento';
  const modules = MODULES.filter((m) => ctx.modules.includes(m.key as never));

  const banner = onboardingPending ? (
    <div className="gs-banner" role="status">
      <span className="gs-banner-icon">
        <Icon name="sparkles" size={18} />
      </span>
      <span>
        <strong>Primeiro acesso em andamento.</strong> Continue a configuração guiada do restaurante.
      </span>
      <a className="gs-btn gs-btn--small gs-btn--primary" href={config.pathTenants ? '/portal/boas-vindas' : `https://${config.rootDomain}/portal/boas-vindas`}>
        Continuar <Icon name="arrow-right" size={14} />
      </a>
    </div>
  ) : null;
  const access = ctx.permissions['atendimento.acessar'] === 'direct' && ctx.modules.includes('atendimento') ? (
    <Link className="gs-btn gs-btn--primary" href={`${base}/atendimento`}><Icon name="service" size={16} /> Iniciar atendimento</Link>
  ) : null;
  const period = <PeriodFilter base={base} path="/gestao" current={preset} from={kpis.period.from} to={kpis.period.to} />;

  const stats = (
    <section aria-label="Indicadores do período" className="gs-grid gs-grid--stats">
      <Stat icon="dollar" tone="accent" label="Faturamento" value={formatCents(kpis.revenue_cents)} hint={kpis.refunded_cents ? `${formatCents(kpis.refunded_cents)} estornados` : `${kpis.closed_tabs} comandas encerradas`} />
      <Stat icon="receipt" tone="info" label="Pedidos" value={kpis.orders} hint={`${kpis.cancelled_orders} cancelados ou recusados`} />
      <Stat icon="tag" tone="violet" label="Ticket médio" value={formatCents(kpis.avg_ticket_cents)} hint={`Descontos ${formatCents(kpis.discounts_cents)}`} />
      <Stat icon="timer" tone="ok" label="Tempo médio de preparo" value={`${kpis.avg_prep_minutes} min`} hint="da confirmação ao pronto" />
    </section>
  );

  const pendCard = (title = 'Pendências da operação') => (
    <section className="gs-card" aria-label={title}>
      <header className="gs-cardhead">
        <h2 className="gs-h2">{title}</h2>
        {alerts ? <Badge tone="warn">{alerts === 1 ? '1 ponto de atenção' : `${alerts} pontos de atenção`}</Badge> : <Badge tone="ok">Tudo em dia</Badge>}
      </header>
      <ul className="gs-pendlist">
        {pendencies.map((item) => (
          <li key={item.label} data-alert={item.alert}>
            <span className="gs-pend-icon">
              <Icon name={item.icon} size={16} />
            </span>
            <span className="gs-pend-label">{item.label}</span>
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
  );

  const revenueCard = (
    <section className="gs-card gs-card--wide" aria-label="Faturamento por dia">
      <header className="gs-cardhead">
        <h2 className="gs-h2">Faturamento por dia</h2>
        <span className="gs-meta">{periodText}</span>
      </header>
      {days.length > 1 ? <Columns items={days} format={formatCents} /> : <p className="gs-bigline">{formatCents(kpis.revenue_cents)}</p>}
      <div className="gs-split-stats">
        {Object.entries(kpis.by_channel).map(([k, v]) => (
          <span key={k}>
            <span className="gs-meta">{CHANNEL[k] ?? k}</span>
            <strong>{formatCents(v)}</strong>
          </span>
        ))}
      </div>
    </section>
  );

  const teamCard = (
    <section className="gs-card" aria-label="Equipe por função">
      <header className="gs-cardhead">
        <h2 className="gs-h2">Equipe por função</h2>
        <Link className="gs-link" href={`${base}/gestao/equipe`}>
          Ver equipe
        </Link>
      </header>
      <Donut
        items={extras.team.byRole.map((r) => ({ label: r.name, value: r.count }))}
        center={
          <>
            <strong>{extras.team.total}</strong>
            <span>pessoas</span>
          </>
        }
        caption="Equipe por função"
      />
    </section>
  );

  const activityCard = (
    <section className="gs-card" aria-label="Atividades recentes">
      <header className="gs-cardhead">
        <h2 className="gs-h2">Atividades recentes</h2>
        <Link className="gs-link" href={`${base}/gestao/historico`}>
          Histórico
        </Link>
      </header>
      {extras.activity.length ? (
        <ol className="gs-feed">
          {extras.activity.map((a) => (
            <li key={a.id}>
              <span className="gs-feed-dot" />
              <span>
                <strong>{ACTIONS[a.action] ?? a.action}</strong>
                <span className="gs-meta">
                  {a.actor} · {timeAgo(a.at)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <Empty>Sem atividades visíveis para seu perfil.</Empty>
      )}
    </section>
  );

  const topCard = (
    <section className="gs-card" aria-label="Mais vendidos">
      <header className="gs-cardhead">
        <h2 className="gs-h2">Mais vendidos</h2>
        <span className="gs-meta">{periodText}</span>
      </header>
      {kpis.top_products.length ? (
        <ol className="gs-toplist">
          {kpis.top_products.map((t, i) => (
            <li key={t.name}>
              <span className="gs-top-rank">{i + 1}</span>
              <span className="gs-top-art">
                <FoodArt name={t.name} />
              </span>
              <span className="gs-top-name">
                <strong>{t.name}</strong>
                <span className="gs-meta">{t.quantity} vendidos</span>
              </span>
              <strong className="gs-num">{formatCents(t.total_cents)}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <Empty>Sem vendas no período.</Empty>
      )}
    </section>
  );

  const methodsCard = (
    <section className="gs-card" aria-label="Recebimentos por forma">
      <h2 className="gs-h2">Recebimentos por forma</h2>
      {kpis.by_method.length ? (
        <Bars items={kpis.by_method.map((m) => ({ label: m.name, value: m.total_cents }))} format={formatCents} />
      ) : (
        <Empty>Sem recebimentos no período.</Empty>
      )}
    </section>
  );

  const approvalsCard = (
    <section className="gs-card" aria-label="Solicitações pendentes">
      <header className="gs-cardhead">
        <h2 className="gs-h2">
          Solicitações pendentes {extras.approvals.length ? <span className="gs-count">{extras.approvals.length}</span> : null}
        </h2>
        <Link className="gs-link" href={`${base}/gestao/aprovacoes`}>
          Ver todas
        </Link>
      </header>
      {extras.approvals.length ? (
        <ul className="gs-approvals">
          {extras.approvals.map((a) => (
            <li key={a.id}>
              <span className="pdp-avatar">{a.requester.slice(0, 2).toUpperCase()}</span>
              <span>
                <strong>{a.summary}</strong>
                <span className="gs-meta">
                  {a.requester} · {timeAgo(a.requested_at)}
                  {a.amount_cents != null ? ` · ${formatCents(a.amount_cents)}` : ''}
                </span>
              </span>
              <Link className="gs-btn gs-btn--small gs-btn--primary" href={`${base}/gestao/aprovacoes`}>
                Decidir
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Nenhuma solicitação aguardando.</Empty>
      )}
    </section>
  );

  if (model === 'm2') {
    return (
      <>
        {banner}
        <section className="gs-hero">
          <div>
            <p className="gs-eyebrow">Painel · {periodText}</p>
            <h1 className="gs-h1">Bom trabalho, {firstName}.</h1>
            <p className="gs-sub">Um resumo calmo do que importa hoje no {ctx.tenant.name}.</p>
            {period}
          </div>
          <EditorialArt />
        </section>
        <section className="gs-editorial-stats" aria-label="Indicadores">
          <div>
            <span className="gs-meta">Faturamento</span>
            <strong>{formatCents(kpis.revenue_cents)}</strong>
          </div>
          <div>
            <span className="gs-meta">Pedidos</span>
            <strong>{kpis.orders}</strong>
          </div>
          <div>
            <span className="gs-meta">Ticket médio</span>
            <strong>{formatCents(kpis.avg_ticket_cents)}</strong>
          </div>
          <div>
            <span className="gs-meta">Preparo médio</span>
            <strong>{kpis.avg_prep_minutes} min</strong>
          </div>
        </section>
        <div className="gs-grid gs-grid--editorial">
          {topCard}
          {pendCard('O que pede atenção')}
        </div>
        <div className="gs-grid">
          {activityCard}
          {methodsCard}
        </div>
      </>
    );
  }

  if (model === 'm3') {
    return (
      <>
        {banner}
        <PageHead title="Painel de Gestão" subtitle={`Dia operacional ${formatDate(kpis.today)} · ${periodText}`} actions={<div className="gs-row">{period}{access}</div>} />
        {stats}
        <div className="gs-grid gs-grid--suite">
          {revenueCard}
          {methodsCard}
        </div>
        <div className="gs-grid gs-grid--suite">
          <section className="gs-card" aria-label="Plano e licença">
            <header className="gs-cardhead">
              <h2 className="gs-h2">Plano e licença</h2>
              <Link className="gs-link" href={`${base}/gestao/licencas`}>
                Detalhes
              </Link>
            </header>
            <div className="gs-plan">
              <span className="gs-plan-icon">
                <Icon name="crown" size={22} />
              </span>
              <span>
                <span className="gs-meta">Plano atual</span>
                <strong className="gs-plan-name">{plan}</strong>
                <span className="gs-meta">Licença {license}</span>
              </span>
            </div>
            <ul className="gs-modules-inline">
              {modules.map((m) => (
                <li key={m.key}>
                  <Icon name="check" size={14} /> {m.label}
                </li>
              ))}
            </ul>
          </section>
          {pendCard()}
          {topCard}
        </div>
      </>
    );
  }

  if (model === 'm4') {
    return (
      <>
        {banner}
        <PageHead title="Painel de Gestão" subtitle={`Visão operacional em tempo real · ${periodText}`} actions={<div className="gs-row">{period}{access}</div>} />
        <section className="gs-grid gs-grid--stats" aria-label="Situação">
          <Stat icon="crown" tone="warn" label="Plano" value={plan} hint={`Licença ${license}`} />
          <Stat icon="users" tone="info" label="Usuários ativos" value={extras.team.total} hint={`${extras.team.byRole.length} funções em uso`} />
          <Stat icon="shield" tone="ok" label="Aprovações" value={p.approvals} hint="aguardando decisão" />
          <Stat icon="alert" tone="danger" label="Alertas" value={alerts} hint="pontos de atenção agora" />
        </section>
        <div className="gs-grid gs-grid--control">
          {approvalsCard}
          {activityCard}
          <section className="gs-card" aria-label="Indicadores do período">
            <h2 className="gs-h2">Período</h2>
            <ul className="gs-kv">
              <li>
                <span>Faturamento</span>
                <strong>{formatCents(kpis.revenue_cents)}</strong>
              </li>
              <li>
                <span>Pedidos</span>
                <strong>{kpis.orders}</strong>
              </li>
              <li>
                <span>Ticket médio</span>
                <strong>{formatCents(kpis.avg_ticket_cents)}</strong>
              </li>
              <li>
                <span>Preparo médio</span>
                <strong>{kpis.avg_prep_minutes} min</strong>
              </li>
            </ul>
          </section>
        </div>
        <section aria-label="Módulos" className="gs-modules">
          {modules.map((m) => (
            <a key={m.key} className="gs-module" href={`${base}${m.path}`} data-module={m.key}>
              <span className="gs-module-icon">
                <Icon name={m.icon} size={20} />
              </span>
              <span>
                <strong>{m.label}</strong>
                <span className="gs-meta">Abrir módulo</span>
              </span>
              <Icon name="arrow-up-right" size={16} />
            </a>
          ))}
        </section>
      </>
    );
  }

  return (
    <>
      {banner}
      <PageHead title="Gestão" subtitle={`Olá, ${firstName}. Controle tudo o que acontece no seu restaurante em um só lugar.`} actions={<div className="gs-row">{period}{access}</div>} />
      {stats}
      <div className="gs-grid gs-grid--command">
        {revenueCard}
        {teamCard}
      </div>
      <div className="gs-grid gs-grid--command3">
        {pendCard()}
        {activityCard}
        {topCard}
      </div>
    </>
  );
}
