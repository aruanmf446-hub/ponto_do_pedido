'use server';

import { rpc } from '@/core/rpc';

// Ações do Atendimento (validadas no banco: permissão, estado e idempotência).

type TabJson = { id: string; status: string; total_cents: number; paid_cents: number; balance_cents: number; table_id: string | null };

export async function openTab(tenantId: string, tableId: string | null, customerName: string, guests: number | null, key: string) {
  return rpc<TabJson>('tab_open', {
    p_tenant: tenantId,
    p_table: tableId,
    p_customer_name: customerName || null,
    p_guest_count: guests,
    p_idempotency_key: key,
  });
}

export async function sendOrder(tenantId: string, tabId: string, items: { product_id: string; quantity: number; notes: string }[], notes: string, key: string) {
  return rpc<{ order: { id: string; number: number }; duplicate: boolean }>('order_create', {
    p_tenant: tenantId,
    p_tab: tabId,
    p_items: items,
    p_notes: notes || null,
    p_idempotency_key: key,
  });
}

export async function reviewCustomerOrder(tenantId: string, orderId: string, accept: boolean, reason: string) {
  return rpc('order_review_customer', { p_tenant: tenantId, p_order: orderId, p_accept: accept, p_reason: reason || null });
}

export async function cancelOrder(tenantId: string, orderId: string, reason: string) {
  return rpc('order_cancel', { p_tenant: tenantId, p_order: orderId, p_reason: reason, p_context: 'atendimento' });
}

export async function cancelItem(tenantId: string, itemId: string, reason: string) {
  return rpc('order_item_cancel', { p_tenant: tenantId, p_item: itemId, p_reason: reason });
}

export async function resolveIssue(tenantId: string, orderId: string) {
  return rpc('order_resolve_issue', { p_tenant: tenantId, p_order: orderId });
}

export async function deliverOrder(tenantId: string, orderId: string) {
  return rpc<TabJson>('order_deliver', { p_tenant: tenantId, p_order: orderId, p_context: 'atendimento' });
}

export async function transferTab(tenantId: string, tabId: string, toTable: string) {
  return rpc<TabJson>('tab_transfer', { p_tenant: tenantId, p_tab: tabId, p_to_table: toTable });
}

export async function requestBill(tenantId: string, tabId: string, forward: boolean) {
  return rpc<TabJson>('tab_request_bill', { p_tenant: tenantId, p_tab: tabId, p_forward_to_cashier: forward });
}

export async function closeTab(tenantId: string, tabId: string) {
  return rpc<TabJson>('tab_close', { p_tenant: tenantId, p_tab: tabId });
}

export async function receivePayment(
  tenantId: string,
  input: { tabId: string; methodId: string; amountCents: number; tenderedCents: number | null; payer: string; key: string },
) {
  return rpc<{ closed: boolean; tab: TabJson; payment: { change_cents: number; receipt_number: number } }>('payment_register', {
    p_tenant: tenantId,
    p_tab: input.tabId,
    p_method: input.methodId,
    p_amount_cents: input.amountCents,
    p_tendered_cents: input.tenderedCents,
    p_payer_label: input.payer || null,
    p_context: 'atendimento',
    p_idempotency_key: input.key,
  });
}
