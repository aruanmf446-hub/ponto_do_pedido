'use server';

import { rpc } from '@/core/rpc';

export async function openCash(tenantId: string, openingCents: number, key: string) {
  return rpc<string>('cash_session_open', { p_tenant: tenantId, p_opening_cents: openingCents, p_idempotency_key: key });
}

export async function charge(
  tenantId: string,
  input: { tabId: string; methodId: string; amountCents: number; tenderedCents: number | null; payer: string; key: string },
) {
  return rpc<{ closed: boolean; payment: { id: string; change_cents: number; receipt_number: number }; tab: { balance_cents: number; status: string } }>(
    'payment_register',
    {
      p_tenant: tenantId,
      p_tab: input.tabId,
      p_method: input.methodId,
      p_amount_cents: input.amountCents,
      p_tendered_cents: input.tenderedCents,
      p_payer_label: input.payer || null,
      p_context: 'caixa',
      p_idempotency_key: input.key,
    },
  );
}

export async function setDiscount(tenantId: string, tabId: string, discountCents: number, reason: string) {
  return rpc('tab_set_discount', { p_tenant: tenantId, p_tab: tabId, p_discount_cents: discountCents, p_reason: reason });
}

export async function refund(tenantId: string, paymentId: string, reason: string) {
  return rpc('payment_refund', { p_tenant: tenantId, p_payment: paymentId, p_reason: reason });
}

export async function moveCash(tenantId: string, kind: 'sangria' | 'suprimento', amountCents: number, reason: string, key: string) {
  return rpc<string>('cash_movement_register', {
    p_tenant: tenantId,
    p_kind: kind,
    p_amount_cents: amountCents,
    p_reason: reason,
    p_idempotency_key: key,
  });
}

export async function closeCash(tenantId: string, sessionId: string, counted: Record<string, number>, notes: string) {
  return rpc<{ status: string; divergence_cents: number }>('cash_session_close', {
    p_tenant: tenantId,
    p_session: sessionId,
    p_counted: counted,
    p_notes: notes || null,
  });
}
