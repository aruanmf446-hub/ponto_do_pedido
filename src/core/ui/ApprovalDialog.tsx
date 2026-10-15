'use client';

import { useState, useTransition } from 'react';
import { requestApproval } from '@/core/actions';
import { formatCents } from '@/core/money';
import { Dialog } from '@/core/ui/Dialog';
import type { PendingApproval } from '@/core/ui/useAction';

/**
 * Solicitação de aprovação a partir de uma ação bloqueada. A aprovação é
 * pontual: não concede poderes permanentes e é revalidada antes da execução.
 */
export function ApprovalDialog({
  tenantId,
  approval,
  onClose,
}: {
  tenantId: string;
  approval: PendingApproval | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    setReason('');
    setMessage(null);
    onClose();
  };

  return (
    <Dialog
      open={!!approval}
      onClose={close}
      title="Aprovação necessária"
      footer={
        message?.kind === 'ok' ? (
          <button type="button" className="pdp-btn pdp-btn--primary" onClick={close}>
            Entendi
          </button>
        ) : (
          <>
            <button type="button" className="pdp-btn" onClick={close}>
              Cancelar
            </button>
            <button
              type="button"
              className="pdp-btn pdp-btn--primary"
              disabled={pending || reason.trim().length < 3}
              onClick={() =>
                start(async () => {
                  if (!approval) return;
                  const result = await requestApproval({
                    tenantId,
                    permission: approval.permission,
                    kind: approval.kind,
                    summary: approval.summary,
                    amountCents: approval.amountCents ?? null,
                    payload: approval.payload,
                    reason,
                  });
                  setMessage(
                    result.ok
                      ? { kind: 'ok', text: 'Solicitação enviada. O responsável decide no próprio aplicativo ou na Gestão.' }
                      : { kind: 'error', text: result.message },
                  );
                })
              }
            >
              {pending ? 'Enviando…' : 'Solicitar aprovação'}
            </button>
          </>
        )
      }
    >
      {approval ? (
        <div className="pdp-approval">
          <p>Esta ação ultrapassa sua autorização. Você pode encaminhá-la a um responsável com autoridade suficiente.</p>
          <dl className="pdp-approval-summary">
            <dt>Ação</dt>
            <dd>{approval.summary}</dd>
            {approval.amountCents != null ? (
              <>
                <dt>Valor</dt>
                <dd>{formatCents(approval.amountCents)}</dd>
              </>
            ) : null}
          </dl>
          {message?.kind !== 'ok' ? (
            <label className="pdp-field">
              <span>Justificativa</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required />
            </label>
          ) : null}
          {message ? (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={`pdp-msg pdp-msg--${message.kind}`}>
              {message.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}
