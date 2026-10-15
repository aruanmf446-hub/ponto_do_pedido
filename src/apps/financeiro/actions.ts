'use server';

import { rpc } from '@/core/rpc';

type Line = { material_id: string | null; description: string; quantity: number; unit: string };

export async function saveSupplier(
  tenantId: string,
  s: { id: string | null; name: string; document: string; contact_name: string; phone: string; email: string; notes: string; active: boolean },
) {
  return rpc<string>('supplier_save', {
    p_tenant: tenantId,
    p_id: s.id,
    p_name: s.name,
    p_document: s.document || null,
    p_contact_name: s.contact_name || null,
    p_phone: s.phone || null,
    p_email: s.email || null,
    p_notes: s.notes || null,
    p_active: s.active,
  });
}

export async function saveDocument(
  tenantId: string,
  d: { kind: string; title: string; storage_path: string | null; supplier_id: string | null; amount_cents: number | null; issued_on: string | null; valid_until: string | null; notes: string },
) {
  return rpc<string>('document_save', {
    p_tenant: tenantId,
    p_kind: d.kind,
    p_title: d.title,
    p_storage_path: d.storage_path,
    p_supplier: d.supplier_id,
    p_amount_cents: d.amount_cents,
    p_issued_on: d.issued_on,
    p_valid_until: d.valid_until,
    p_related_entity: null,
    p_related_id: null,
    p_notes: d.notes || null,
  });
}

export async function createPurchaseRequest(tenantId: string, justification: string, neededBy: string | null, items: Line[]) {
  return rpc<string>('purchase_request_create', { p_tenant: tenantId, p_justification: justification, p_needed_by: neededBy, p_items: items });
}

export async function addQuotation(
  tenantId: string,
  q: { request_id: string; supplier_id: string; total_cents: number; delivery_days: number | null; valid_until: string | null; payment_terms: string; notes: string },
) {
  return rpc<string>('quotation_add', {
    p_tenant: tenantId,
    p_request: q.request_id,
    p_supplier: q.supplier_id,
    p_total_cents: q.total_cents,
    p_delivery_days: q.delivery_days,
    p_valid_until: q.valid_until,
    p_payment_terms: q.payment_terms || null,
    p_notes: q.notes || null,
    p_document: null,
  });
}

export async function decidePurchase(tenantId: string, requestId: string, quotationId: string | null, approve: boolean, note: string) {
  return rpc('purchase_decide', { p_tenant: tenantId, p_request: requestId, p_quotation: quotationId, p_approve: approve, p_note: note || null });
}

export async function issuePurchaseOrder(tenantId: string, requestId: string, expectedOn: string | null, dueDays: number, items: (Line & { unit_price_cents: number })[]) {
  return rpc<string>('purchase_order_issue', { p_tenant: tenantId, p_request: requestId, p_expected_on: expectedOn, p_payment_due_days: dueDays, p_items: items });
}

export async function registerReceipt(
  tenantId: string,
  orderId: string,
  items: { po_item_id: string; quantity: number; location_id: string | null; lot_code: string | null; expires_on: string | null }[],
  invoiceNumber: string,
  notes: string,
  key: string,
) {
  return rpc<string>('goods_receipt_register', {
    p_tenant: tenantId,
    p_order: orderId,
    p_items: items,
    p_invoice_number: invoiceNumber || null,
    p_invoice_document: null,
    p_notes: notes || null,
    p_idempotency_key: key,
  });
}

export async function createPayable(
  tenantId: string,
  p: { kind: string; supplier_id: string | null; description: string; category: string; amount_cents: number; due_date: string; document_id: string | null },
  key: string,
) {
  return rpc<string>('payable_create', {
    p_tenant: tenantId,
    p_kind: p.kind,
    p_supplier: p.supplier_id,
    p_description: p.description,
    p_category: p.category,
    p_amount_cents: p.amount_cents,
    p_due_date: p.due_date,
    p_document: p.document_id,
    p_idempotency_key: key,
  });
}

export async function payPayable(tenantId: string, payableId: string, method: string, proofDocument: string | null) {
  return rpc('payable_pay', { p_tenant: tenantId, p_payable: payableId, p_paid_method: method, p_proof_document: proofDocument });
}

export async function cancelPayable(tenantId: string, payableId: string, reason: string) {
  return rpc('payable_cancel', { p_tenant: tenantId, p_payable: payableId, p_reason: reason });
}

export async function createReceivable(tenantId: string, customer: string, description: string, amountCents: number, dueDate: string) {
  return rpc<string>('receivable_save', { p_tenant: tenantId, p_customer: customer, p_description: description, p_amount_cents: amountCents, p_due_date: dueDate });
}

export async function settleReceivable(tenantId: string, id: string, note: string) {
  return rpc('receivable_settle', { p_tenant: tenantId, p_receivable: id, p_note: note || null });
}

export async function setBudget(tenantId: string, category: string, month: string, limitCents: number) {
  return rpc('budget_set', { p_tenant: tenantId, p_category: category, p_month: month, p_limit_cents: limitCents });
}

export async function requestReimbursement(tenantId: string, description: string, category: string, amountCents: number, spentOn: string, documentId: string | null) {
  return rpc<string>('reimbursement_request', {
    p_tenant: tenantId,
    p_description: description,
    p_category: category,
    p_amount_cents: amountCents,
    p_spent_on: spentOn,
    p_document: documentId,
  });
}

export async function decideReimbursement(tenantId: string, id: string, approve: boolean, note: string) {
  return rpc('reimbursement_decide', { p_tenant: tenantId, p_id: id, p_approve: approve, p_note: note || null });
}

export async function manualEntry(tenantId: string, direction: 'in' | 'out', amountCents: number, occurredOn: string, description: string) {
  return rpc<string>('financial_entry_manual', { p_tenant: tenantId, p_direction: direction, p_amount_cents: amountCents, p_occurred_on: occurredOn, p_description: description });
}

export async function reconcile(tenantId: string, entryId: string, bankReference: string, reconciled: boolean) {
  return rpc('financial_reconcile', { p_tenant: tenantId, p_entry: entryId, p_bank_reference: bankReference || null, p_reconciled: reconciled });
}

export async function authorizeSupply(tenantId: string, requestId: string, approve: boolean, note: string) {
  return rpc('material_request_authorize', { p_tenant: tenantId, p_request: requestId, p_approve: approve, p_note: note || null });
}
