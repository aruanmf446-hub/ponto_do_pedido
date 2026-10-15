import { formatDate } from '@/core/dates';
import { formatCents } from '@/core/money';
import type { Kpis } from '@/apps/gestao/queries';
import { PeriodFilter } from '@/apps/gestao/pages/Dashboard';
import { PageHead } from '@/apps/gestao/ui';
import { CsvButton } from '@/apps/gestao/pages/CsvButton';

export function Reports({ kpis, base, preset }: { kpis: Kpis; base: string; preset: string }) {
  const days = kpis.by_day;
  return (
    <>
      <PageHead
        title="Relatórios"
        subtitle="Resultados por dia operacional, forma de recebimento e produto."
        actions={<PeriodFilter base={base} path="/gestao/relatorios" current={preset} from={kpis.period.from} to={kpis.period.to} />}
      />
      <div className="gs-grid">
        <section className="gs-card" aria-labelledby="r-dias">
          <div className="gs-cardhead">
            <h2 id="r-dias" className="gs-h2">
              Vendas por dia
            </h2>
            <CsvButton
              filename={`vendas-${kpis.period.from}-${kpis.period.to}.csv`}
              rows={[['Dia', 'Faturamento (R$)'], ...days.map((d) => [d.day, (d.total_cents / 100).toFixed(2)])]}
            />
          </div>
          <div className="gs-table-wrap">
            <table className="gs-table">
              <thead>
                <tr>
                  <th>Dia operacional</th>
                  <th className="gs-num">Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.day}>
                    <td>{formatDate(d.day)}</td>
                    <td className="gs-num">{formatCents(d.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th className="gs-num">{formatCents(kpis.revenue_cents)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
        <section className="gs-card" aria-labelledby="r-prod">
          <div className="gs-cardhead">
            <h2 id="r-prod" className="gs-h2">
              Produtos
            </h2>
            <CsvButton
              filename={`produtos-${kpis.period.from}-${kpis.period.to}.csv`}
              rows={[['Produto', 'Quantidade', 'Total (R$)'], ...kpis.top_products.map((p) => [p.name, String(p.quantity), (p.total_cents / 100).toFixed(2)])]}
            />
          </div>
          <div className="gs-table-wrap">
            <table className="gs-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="gs-num">Qtd.</th>
                  <th className="gs-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {kpis.top_products.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td className="gs-num">{p.quantity}</td>
                    <td className="gs-num">{formatCents(p.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="gs-card" aria-labelledby="r-met">
          <h2 id="r-met" className="gs-h2">
            Formas de recebimento
          </h2>
          <div className="gs-table-wrap">
            <table className="gs-table">
              <thead>
                <tr>
                  <th>Forma</th>
                  <th className="gs-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {kpis.by_method.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td className="gs-num">{formatCents(m.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="gs-list">
            <li>
              <span>Descontos</span>
              <strong>{formatCents(kpis.discounts_cents)}</strong>
            </li>
            <li>
              <span>Taxa de serviço</span>
              <strong>{formatCents(kpis.service_fee_cents)}</strong>
            </li>
            <li>
              <span>Estornos</span>
              <strong>{formatCents(kpis.refunded_cents)}</strong>
            </li>
            <li>
              <span>Divergência de caixa</span>
              <strong>{formatCents(kpis.pending.cash_divergence_cents)}</strong>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
