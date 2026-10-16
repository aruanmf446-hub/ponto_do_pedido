'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { APP_LABELS, type AppModule } from '@/core/apps';
import type { Plan, Subscription } from '@/core/plans';
import { planPriceLabel } from '@/core/plans';
import { formatDate } from '@/core/dates';
import { formatCents } from '@/core/money';
import { Dialog } from '@/core/ui/Dialog';
import { tenantDisplayUrl, tenantUrl } from '@/core/tenant/urls';
import { startPayment, subscriptionAction } from '@/apps/plataforma/actions';

const STATUS: Record<Subscription['status'], { label: string; tone: string }> = {
  active: { label: 'Ativa', tone: 'ok' },
  pending_payment: { label: 'Aguardando pagamento', tone: 'warn' },
  past_due: { label: 'Pagamento pendente', tone: 'warn' },
  suspended: { label: 'Suspensa', tone: 'danger' },
  cancelled: { label: 'Cancelada', tone: 'danger' },
};

export function SubscriptionCard({
  sub,
  onboardingDone,
  paymentProvider,
}: {
  sub: Subscription;
  plans: Plan[];
  onboardingDone: boolean;
  paymentProvider?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'cancel' | null>(null);
  const status = STATUS[sub.status];
  const operational = sub.status === 'active' || sub.status === 'past_due';

  const online = paymentProvider === 'mercadopago';
  const awaitingPayment = online && (sub.status === 'pending_payment' || sub.status === 'past_due');

  const pay = () =>
    start(async () => {
      setError(null);
      const result = await startPayment(sub.id);
      if (!result.ok) setError(result.message);
      else window.location.assign(result.data.checkout_url);
    });

  const run = (action: Parameters<typeof subscriptionAction>[0], planCode?: string) =>
    start(async () => {
      setError(null);
      const result = await subscriptionAction(action, sub.id, planCode);
      if (!result.ok) setError(result.message);
      else {
        setDialog(null);
        router.refresh();
      }
    });

  return (
    <article className="pl-card" aria-labelledby={`sub-${sub.id}`}>
      <div className="pl-row" style={{ justifyContent: 'space-between' }}>
        <h2 id={`sub-${sub.id}`}>{sub.restaurant_name}</h2>
        <span className="pl-badge" data-tone={status.tone}>
          {status.label}
          {sub.cancel_at_period_end && operational ? ' · cancelamento agendado' : ''}
        </span>
      </div>
      <dl className="pl-kv">
        <div>
          <dt>Plano</dt>
          <dd>{sub.plan_name}</dd>
        </div>
        <div>
          <dt>Valor</dt>
          <dd>{planPriceLabel(sub)}</dd>
        </div>
        <div>
          <dt>Vigência até</dt>
          <dd>{formatDate(sub.current_period_end)}</dd>
        </div>
        <div>
          <dt>Contratado em</dt>
          <dd>{formatDate(sub.created_at)}</dd>
        </div>
      </dl>
      <div>
        <p className="pl-muted" style={{ margin: '0 0 8px' }}>
          Aplicativos contratados
        </p>
        <ul className="pl-chips">
          {sub.modules.map((m) => (
            <li key={m}>{APP_LABELS[m as AppModule] ?? m}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="pl-muted" style={{ margin: '0 0 8px' }}>
          Endereço do restaurante — distribua para a equipe
        </p>
        <p className="pl-url">{tenantDisplayUrl(sub.restaurant_slug)}</p>
      </div>
      {sub.status === 'pending_payment' ? (
        <p className="pl-muted">
          Acesso aguardando confirmação do pagamento.{!online ? ' Pagamento online indisponível no momento.' : ''}
        </p>
      ) : null}
      <div className="pl-row">
        {operational ? (
          <a className="pl-btn" href={tenantUrl(sub.restaurant_slug, '/gestao')}>
            Abrir Gestão
          </a>
        ) : null}
        {operational && !onboardingDone ? (
          <a className="pl-btn pl-btn--ghost" href={`/portal/boas-vindas?r=${sub.restaurant_slug}`}>
            Continuar primeiro acesso
          </a>
        ) : null}
        {awaitingPayment ? (
          <button type="button" className="pl-btn" disabled={pending} onClick={pay}>
            Pagar agora
          </button>
        ) : null}
        {operational ? (
          <p className="pl-muted">
            Renovação e alteração de plano dependem de pagamento confirmado e estão indisponíveis neste momento.
          </p>
        ) : null}
        {operational && !sub.cancel_at_period_end ? (
          <button type="button" className="pl-btn pl-btn--danger" disabled={pending} onClick={() => setDialog('cancel')}>
            Cancelar assinatura
          </button>
        ) : null}
        {operational && sub.cancel_at_period_end ? (
          <button type="button" className="pl-btn pl-btn--ghost" disabled={pending} onClick={() => run('undo_cancel')}>
            Manter assinatura
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="pl-error">
          {error}
        </p>
      ) : null}
      {sub.invoices.length > 0 ? (
        <details>
          <summary>Faturas da plataforma</summary>
          <div className="pl-table-wrap" style={{ marginTop: 12 }}>
            <table className="pl-table">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {sub.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      {formatDate(inv.period_start)} — {formatDate(inv.period_end)}
                    </td>
                    <td>{formatDate(inv.due_date)}</td>
                    <td>{inv.amount_cents == null ? 'A definir' : formatCents(inv.amount_cents)}</td>
                    <td>{inv.status === 'paid' ? 'Paga' : inv.status === 'void' ? 'Anulada' : 'Em aberto'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      <Dialog open={dialog === 'cancel'} onClose={() => setDialog(null)} title="Cancelar assinatura">
        <p>
          O cancelamento é efetivado ao fim do período vigente ({formatDate(sub.current_period_end)}). Até lá, o restaurante
          continua operando e você pode desistir do cancelamento.
        </p>
        <div className="pl-dialog-actions">
          <button type="button" className="pl-btn pl-btn--danger" disabled={pending} onClick={() => run('cancel')}>
            Confirmar cancelamento
          </button>
        </div>
      </Dialog>
    </article>
  );
}
