'use server';

import { rpc } from '@/core/rpc';

export async function saveMaterial(
  tenantId: string,
  m: { id: string | null; name: string; category: string; unit: string; sku: string; min_qty: number; reorder_qty: number; perishable: boolean; active: boolean },
) {
  return rpc<string>('material_save', {
    p_tenant: tenantId,
    p_id: m.id,
    p_name: m.name,
    p_category: m.category,
    p_unit: m.unit,
    p_sku: m.sku || null,
    p_min_qty: m.min_qty,
    p_reorder_qty: m.reorder_qty,
    p_perishable: m.perishable,
    p_active: m.active,
  });
}

export async function saveLocation(tenantId: string, l: { id: string | null; name: string; kind: string; active: boolean }) {
  return rpc<string>('stock_location_save', { p_tenant: tenantId, p_id: l.id, p_name: l.name, p_kind: l.kind, p_parent: null, p_active: l.active });
}

export async function stockEntry(
  tenantId: string,
  e: { material_id: string; location_id: string; qty: number; lot_code: string; expires_on: string | null; unit_cost_cents: number | null; reason: string },
  key: string,
) {
  return rpc<string>('stock_entry', {
    p_tenant: tenantId,
    p_material: e.material_id,
    p_location: e.location_id,
    p_qty: e.qty,
    p_lot_code: e.lot_code || null,
    p_expires_on: e.expires_on,
    p_unit_cost_cents: e.unit_cost_cents,
    p_reason: e.reason || 'Entrada avulsa',
    p_idempotency_key: key,
  });
}

export async function stockOut(tenantId: string, lotId: string, kind: 'saida' | 'perda' | 'descarte' | 'ajuste', qty: number, reason: string, key: string) {
  return rpc('stock_out', { p_tenant: tenantId, p_lot: lotId, p_kind: kind, p_qty: qty, p_reason: reason, p_idempotency_key: key });
}

export async function stockTransfer(tenantId: string, lotId: string, toLocation: string, qty: number, reason: string, key: string) {
  return rpc<string>('stock_transfer', { p_tenant: tenantId, p_lot: lotId, p_to_location: toLocation, p_qty: qty, p_reason: reason || null, p_idempotency_key: key });
}

export async function blockLot(tenantId: string, lotId: string, blocked: boolean, reason: string) {
  return rpc('stock_lot_block', { p_tenant: tenantId, p_lot: lotId, p_blocked: blocked, p_reason: reason || null });
}

export async function startInventory(tenantId: string, locationId: string | null, notes: string) {
  return rpc<string>('inventory_start', { p_tenant: tenantId, p_location: locationId, p_notes: notes || null });
}

export async function countLine(tenantId: string, lineId: string, counted: number) {
  return rpc('inventory_count_line', { p_tenant: tenantId, p_line: lineId, p_counted: counted });
}

export async function closeInventory(tenantId: string, countId: string) {
  return rpc<{ adjusted: number }>('inventory_close', { p_tenant: tenantId, p_count: countId });
}

export async function fulfillRequest(tenantId: string, requestId: string) {
  return rpc<{ fulfilled: boolean; missing?: { material_id: string; quantity: number }[] }>('material_request_fulfill', { p_tenant: tenantId, p_request: requestId });
}

export async function requestToPurchase(tenantId: string, requestId: string, justification: string) {
  return rpc<string>('material_request_to_purchase', { p_tenant: tenantId, p_request: requestId, p_justification: justification || null });
}

export async function createMaterialRequest(tenantId: string, sector: string | null, items: { material_id: string; quantity: number }[], notes: string, neededBy: string | null) {
  return rpc<string>('material_request_create', { p_tenant: tenantId, p_sector: sector, p_items: items, p_notes: notes || null, p_needed_by: neededBy });
}

export async function receivePurchase(
  tenantId: string,
  orderId: string,
  items: { po_item_id: string; quantity: number; location_id: string | null; lot_code: string | null; expires_on: string | null }[],
  invoiceNumber: string,
  key: string,
) {
  return rpc<string>('goods_receipt_register', {
    p_tenant: tenantId,
    p_order: orderId,
    p_items: items,
    p_invoice_number: invoiceNumber || null,
    p_invoice_document: null,
    p_notes: null,
    p_idempotency_key: key,
  });
}
