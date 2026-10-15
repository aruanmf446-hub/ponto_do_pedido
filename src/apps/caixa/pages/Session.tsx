'use client';

import Link from 'next/link';
import { useState } from 'react';
import { executeApproval } from '@/core/actions';
import { formatDateTime, formatTime } from '@/core/dates';
import { formatCents, parseCents } from '@/core/money';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { usePermission, useTenant } from '@/core/ui/TenantProvider';
import { newIdempotencyKey, useAction } from '@/core/ui/useAction';
import { closeCash, moveCash } from '@/apps/caixa/actions';
import type { Expected } from '@/apps/caixa/queries';

type Approval = { id: string; summary: string; status: string; can_execute: boolean };

export function Movements({
  movements,
  payments,
  approvals,
}: {
  movements: { id: string; kind: string; amount_cents: number; reason: string; created_at: string }[];
  payments: { id: string; amount_cents: number; change_cents: number; method_kind: string; status: string; received_at: string; receipt_number: number; tab: { number: number } | null; method: { name: string } | null }[];
  approvals: Approval[];
}) {
  const { tenantId, timezone, base } = useTenant();
  const canSangria = usePermission('caixa.sangria') !== 'deny';
  const canSuprimento = usePermission('caixa.suprimento') === 'direct';
  const action = useAction();
  const [kind, setKind] = useState<'sangria' | 'suprimento'>(canSangria ? 'sangria' : 'suprimento');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [key, setKey] = useState(() => newIdempotencyKey('mov'));
  const ready = approvals.filter((a) => a.can_execute);

  return (
    <div className="cx-section">
      <h1 className="cx-h1">Movimentações do caixa</h1>
      {ready.length ? (
        <section className="cx-card cx-alertbox" aria-label="Aprovações liberadas">
          <h2 className="cx-h2">Aprovações liberadas para execução</h2>
          {ready.map((a) => (
            <div key={a.id} className="cx-row cx-spread">
              <span>{a.summary}</span>
              <button type="button" className="cx-btn cx-btn--primary cx-btn--small" onClick={() => void action.run(() => executeApproval(tenantId, a.id))}>
                Executar agora
              </button>
            </div>
          ))}
        </section>
      ) : null}
      <div className="cx-grid">
        <section className="cx-card" aria-labelledby="nova-mov">
          <h2 id="nova-mov" className="cx-h2">
            Registrar
          </h2>
          <div className="cx-methods" role="radiogroup" aria-label="Tipo">
            {canSangria ? (
              <button type="button" role="radio" aria-checked={kind === 'sangria'} className="cx-method" onClick={() => setKind('sangria')}>
                Sangria (retirada)
              </button>
            ) : null}
            {canSuprimento ? (
              <button type="button" role="radio" aria-checked={kind === 'suprimento'} className="cx-method" onClick={() => setKind('suprimento')}>
                Suprimento (reforço)
              </button>
            ) : null}
          </div>
          <label className="cx-field">
            Valor (R$)
            <input className="cx-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="cx-field">
            Motivo
            <input className="cx-input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {action.error ? <p className="cx-error">{action.error.message}</p> : null}
          <button
            type="button"
            className="cx-btn cx-btn--primary"
            disabled={action.pending || (parseCents(amount) ?? 0) <= 0 || reason.trim().length < 3}
            onClick={() => {
              const cents = parseCents(amount) ?? 0;
              void action.run(() => moveCash(tenantId, kind, cents, reason.trim(), key), {
                onSuccess: () => (setAmount(''), setReason(''), setKey(newIdempotencyKey('mov'))),
                approval:
                  kind === 'sangria'
                    ? { kind: 'cash.sangria', summary: `Sangria de ${formatCents(cents)}`, amountCents: cents, payload: { amount_cents: cents, reason: reason.trim() } }
                    : undefined,
              });
            }}
          >
            Registrar {kind}
          </button>
        </section>
        <section className="cx-card" aria-labelledby="mov-list">
          <h2 id="mov-list" className="cx-h2">
            Sangrias e suprimentos
          </h2>
          {movements.length === 0 ? <p className="cx-muted">Nenhuma movimentação neste turno.</p> : null}
          <ul className="cx-items">
            {movements.map((m) => (
              <li key={m.id}>
                <span>
                  {formatTime(m.created_at, timezone)} · {m.kind === 'sangria' ? 'Sangria' : 'Suprimento'} · {m.reason}
                </span>
                <span>
                  {m.kind === 'sangria' ? '−' : '+'}
                  {formatCents(m.amount_cents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="cx-card" aria-labelledby="rec-list">
        <h2 id="rec-list" className="cx-h2">
          Recebimentos do turno
        </h2>
        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Recibo</th>
                <th>Comanda</th>
                <th>Forma</th>
                <th className="cx-num">Valor</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatTime(p.received_at, timezone)}</td>
                  <td>
                    <Link href={`${base}/caixa/comprovante/${p.id}`}>{p.receipt_number}</Link>
                  </td>
                  <td>#{p.tab?.number}</td>
                  <td>{p.method?.name ?? p.method_kind}</td>
                  <td className="cx-num">{formatCents(p.amount_cents)}</td>
                  <td>{p.status === 'refunded' ? 'Estornado' : 'Confirmado'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </div>
  );
}

export function Closing({ sessionId, expected, openedAt }: { sessionId: string; expected: Expected; openedAt: string }) {
  const { tenantId, timezone, base } = useTenant();
  const canClose = usePermission('caixa.fechar') === 'direct';
  const action = useAction();
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<{ divergence_cents: number } | null>(null);
  const countedCents = (id: string) => parseCents(counted[id] ?? '') ?? 0;
  const divergence = expected.methods.reduce((s, m) => s + countedCents(m.method_id) - m.expected_cents, 0);

  if (result) {
    return (
      <section className="cx-card">
        <h1 className="cx-h1">Caixa fechado</h1>
        <p>{result.divergence_cents === 0 ? 'Conferência sem divergências.' : `Divergência registrada: ${formatCents(result.divergence_cents)}.`}</p>
        <Link className="cx-btn cx-btn--primary" href={`${base}/caixa/historico`}>
          Ver histórico
        </Link>
      </section>
    );
  }

  return (
    <div className="cx-section">
      <h1 className="cx-h1">Conferência e fechamento</h1>
      <p className="cx-muted">
        Turno aberto em {formatDateTime(openedAt, timezone)}. Comandas ainda abertas não impedem o fechamento: elas continuam disponíveis para o próximo turno.
      </p>
      <div className="cx-table-wrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th>Forma</th>
              <th className="cx-num">Recebido</th>
              <th className="cx-num">Estornos</th>
              <th className="cx-num">Esperado</th>
              <th>Contado</th>
              <th className="cx-num">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {expected.methods.map((m) => {
              const diff = countedCents(m.method_id) - m.expected_cents;
              return (
                <tr key={m.method_id}>
                  <td>
                    {m.name}
                    {m.kind === 'dinheiro' ? (
                      <small className="cx-muted">
                        {' '}
                        (fundo {formatCents(expected.opening_cents)} · mov. {formatCents(expected.movements_cents)})
                      </small>
                    ) : null}
                  </td>
                  <td className="cx-num">{formatCents(m.received_cents)}</td>
                  <td className="cx-num">{formatCents(m.refunded_cents)}</td>
                  <td className="cx-num">
                    <strong>{formatCents(m.expected_cents)}</strong>
                  </td>
                  <td>
                    <input
                      className="cx-input"
                      inputMode="decimal"
                      aria-label={`Valor contado em ${m.name}`}
                      value={counted[m.method_id] ?? ''}
                      onChange={(e) => setCounted({ ...counted, [m.method_id]: e.target.value })}
                    />
                  </td>
                  <td className="cx-num" data-diff={diff === 0 ? 'zero' : diff > 0 ? 'pos' : 'neg'}>
                    {counted[m.method_id] ? formatCents(diff) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={5}>Divergência total</th>
              <th className="cx-num">{formatCents(divergence)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
      <label className="cx-field">
        Justificativa {divergence !== 0 ? '(obrigatória)' : '(opcional)'}
        <input className="cx-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {action.error ? <p className="cx-error">{action.error.message}</p> : null}
      <button
        type="button"
        className="cx-btn cx-btn--primary"
        disabled={!canClose || action.pending || expected.methods.some((m) => counted[m.method_id] == null || counted[m.method_id] === '')}
        onClick={() =>
          void action.run(
            () => closeCash(tenantId, sessionId, Object.fromEntries(expected.methods.map((m) => [m.method_id, countedCents(m.method_id)])), notes),
            { onSuccess: (r) => setResult(r) },
          )
        }
      >
        Fechar caixa
      </button>
    </div>
  );
}
