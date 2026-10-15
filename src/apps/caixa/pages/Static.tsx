import { formatDate, formatDateTime } from '@/core/dates';
import { formatCents } from '@/core/money';
import type { CashSession, Payment } from '@/apps/caixa/queries';
import { PrintButton } from '@/apps/caixa/pages/PrintButton';

export function CashHistory({ sessions, timezone }: { sessions: (CashSession & { operator: string })[]; timezone: string }) {
  return (
    <div className="cx-section">
      <h1 className="cx-h1">Histórico de caixas</h1>
      <div className="cx-table-wrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th>Dia operacional</th>
              <th>Operador</th>
              <th>Abertura</th>
              <th>Fechamento</th>
              <th className="cx-num">Fundo</th>
              <th className="cx-num">Esperado</th>
              <th className="cx-num">Divergência</th>
              <th>Justificativa</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const expectedTotal = s.expected?.methods.reduce((sum, m) => sum + m.expected_cents, 0) ?? null;
              return (
                <tr key={s.id}>
                  <td>{formatDate(s.business_day)}</td>
                  <td>{s.operator}</td>
                  <td>{formatDateTime(s.opened_at, timezone)}</td>
                  <td>{s.closed_at ? formatDateTime(s.closed_at, timezone) : 'Aberto'}</td>
                  <td className="cx-num">{formatCents(s.opening_cents)}</td>
                  <td className="cx-num">{expectedTotal == null ? '—' : formatCents(expectedTotal)}</td>
                  <td className="cx-num" data-diff={!s.divergence_cents ? 'zero' : s.divergence_cents > 0 ? 'pos' : 'neg'}>
                    {s.divergence_cents == null ? '—' : formatCents(s.divergence_cents)}
                  </td>
                  <td>{s.notes ?? ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Receipt({
  payment,
  tenantName,
  timezone,
}: {
  payment: Payment & { tab: { number: number; total_cents: number; paid_cents: number; channel: string; table: { label: string } | null } | null };
  tenantName: string;
  timezone: string;
}) {
  return (
    <article className="cx-receipt" aria-label="Comprovante">
      <header>
        <strong>{tenantName}</strong>
        <span>Comprovante de recebimento nº {payment.receipt_number}</span>
        <span>{formatDateTime(payment.received_at, timezone)}</span>
      </header>
      <dl>
        <dt>Comanda</dt>
        <dd>
          #{payment.tab?.number}
          {payment.tab?.table ? ` · Mesa ${payment.tab.table.label}` : ''}
        </dd>
        <dt>Forma</dt>
        <dd>{payment.method?.name ?? payment.method_kind}</dd>
        {payment.payer_label ? (
          <>
            <dt>Pagador</dt>
            <dd>{payment.payer_label}</dd>
          </>
        ) : null}
        <dt>Valor</dt>
        <dd>{formatCents(payment.amount_cents)}</dd>
        {payment.change_cents ? (
          <>
            <dt>Entregue</dt>
            <dd>{formatCents(payment.tendered_cents)}</dd>
            <dt>Troco</dt>
            <dd>{formatCents(payment.change_cents)}</dd>
          </>
        ) : null}
        <dt>Situação</dt>
        <dd>{payment.status === 'refunded' ? 'ESTORNADO' : 'Confirmado'}</dd>
      </dl>
      <p className="cx-muted">Documento sem valor fiscal.</p>
      <PrintButton />
    </article>
  );
}
