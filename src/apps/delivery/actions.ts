'use server';

import { rpc } from '@/core/rpc';

export type DeliveryMenu = {
  state: 'ok' | 'not_found' | 'unavailable';
  tenant?: { name: string; slug: string; logo_path: string | null; phone: string | null; whatsapp: string | null };
  open_now?: boolean;
  eta_minutes?: number | null;
  zones?: { id: string; name: string; neighborhoods: string[]; fee_cents: number; min_order_cents: number; eta_minutes: number | null }[];
  payment_methods?: { id: string; name: string; kind: string }[];
  hours?: { weekday: number; opens: string; closes: string }[];
  categories?: { id: string; name: string; description: string; products: { id: string; name: string; description: string; price_cents: number; image_path: string | null; available: boolean }[] }[];
};

export type Tracking = {
  state: 'ok';
  tenant: { name: string; slug: string; logo_path: string | null; whatsapp: string | null };
  number: number;
  status: 'awaiting_acceptance' | 'accepted' | 'rejected' | 'out_for_delivery' | 'delivered' | 'cancelled';
  rejected_reason: string | null;
  created_at: string;
  accepted_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  kitchen_status: string | null;
  fee_cents: number;
  items: { name: string; quantity: number; unit_price_cents: number; status: string; notes: string | null }[];
  items_cents: number;
  paid_cents: number;
  payment_method: string | null;
} | null;

export async function placeDeliveryOrder(input: {
  slug: string;
  customer: { name: string; whatsapp: string };
  address: { street: string; number: string; complement: string; neighborhood: string; reference: string };
  zoneId: string;
  items: { product_id: string; quantity: number; notes: string }[];
  notes: string;
  paymentMethodId: string | null;
  changeForCents: number | null;
  key: string;
}) {
  return rpc<{ tracking_token: string }>('public_delivery_order', {
    p_slug: input.slug,
    p_customer: input.customer,
    p_address: input.address,
    p_zone: input.zoneId,
    p_items: input.items,
    p_notes: input.notes || null,
    p_payment_method: input.paymentMethodId,
    p_change_for_cents: input.changeForCents,
    p_idempotency_key: input.key,
  });
}

export async function trackDelivery(token: string) {
  return rpc<Tracking>('public_delivery_tracking', { p_token: token });
}

// ---- Central de Delivery (restaurante, com login e permissões) ----

export async function reviewDelivery(tenantId: string, tabId: string, accept: boolean, reason: string) {
  return rpc('delivery_review', { p_tenant: tenantId, p_tab: tabId, p_accept: accept, p_reason: reason || null });
}

export async function dispatchDelivery(tenantId: string, tabId: string) {
  return rpc('delivery_dispatch', { p_tenant: tenantId, p_tab: tabId });
}

export async function completeDelivery(tenantId: string, tabId: string) {
  return rpc('delivery_complete', { p_tenant: tenantId, p_tab: tabId });
}

export async function receiveDeliveryPayment(tenantId: string, tabId: string, methodId: string, amountCents: number, tenderedCents: number | null, key: string) {
  return rpc<{ closed: boolean; payment: { change_cents: number } }>('payment_register', {
    p_tenant: tenantId,
    p_tab: tabId,
    p_method: methodId,
    p_amount_cents: amountCents,
    p_tendered_cents: tenderedCents,
    p_payer_label: null,
    p_context: 'delivery',
    p_idempotency_key: key,
  });
}
