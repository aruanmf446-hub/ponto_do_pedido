'use server';

import { rpc } from '@/core/rpc';

export async function advance(tenantId: string, orderId: string, to: 'preparing' | 'ready', stage: string | null) {
  return rpc('kitchen_advance', { p_tenant: tenantId, p_order: orderId, p_to: to, p_stage: stage });
}

export async function markUnavailable(tenantId: string, itemId: string, note: string) {
  return rpc('kitchen_item_unavailable', { p_tenant: tenantId, p_item: itemId, p_note: note || null });
}

export async function setAvailable(tenantId: string, productId: string, available: boolean) {
  return rpc('product_set_available', { p_tenant: tenantId, p_product: productId, p_available: available });
}

export async function deliverFromKitchen(tenantId: string, orderId: string) {
  return rpc('order_deliver', { p_tenant: tenantId, p_order: orderId, p_context: 'cozinha' });
}

export async function cancelFromKitchen(tenantId: string, orderId: string, reason: string) {
  return rpc('order_cancel', { p_tenant: tenantId, p_order: orderId, p_reason: reason, p_context: 'cozinha' });
}

export async function requestMaterials(tenantId: string, sector: string | null, items: { material_id: string; quantity: number }[], notes: string) {
  return rpc<string>('material_request_create', {
    p_tenant: tenantId,
    p_sector: sector,
    p_items: items,
    p_notes: notes || null,
    p_needed_by: null,
  });
}
