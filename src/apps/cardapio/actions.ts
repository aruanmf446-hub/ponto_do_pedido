'use server';

import { rpc } from '@/core/rpc';

// Ações públicas do Cardápio Digital (sem login). A segurança vem do token
// secreto da mesa e da chave do convidado; o banco valida tudo.

export type TableMenu = {
  state: 'ok' | 'invalid_qr' | 'unavailable';
  tenant?: { name: string; slug: string; logo_path: string | null };
  table?: { label: string };
  mode?: 'consulta' | 'cliente' | 'garcom' | 'ambos';
  confirmation?: 'automatica' | 'atendente';
  service_fee_percent?: number;
  open_now?: boolean;
  categories?: MenuCategory[];
  my_orders?: { id: string; number: number; status: string; created_at: string; items: { name: string; quantity: number; status: string; unit_price_cents: number; notes: string | null }[] }[];
  bill_requested?: boolean;
};

export type MenuCategory = {
  id: string;
  name: string;
  description: string;
  products: { id: string; name: string; description: string; price_cents: number; image_path: string | null; available: boolean }[];
};

export async function refreshTableMenu(qr: string, guestKey: string) {
  return rpc<TableMenu>('public_table_menu', { p_qr: qr, p_guest_key: guestKey });
}

export async function placeTableOrder(qr: string, guestKey: string, items: { product_id: string; quantity: number; notes: string }[], notes: string, key: string) {
  return rpc<{ order_number: number; status: string }>('public_table_order', {
    p_qr: qr,
    p_guest_key: guestKey,
    p_items: items,
    p_notes: notes || null,
    p_idempotency_key: key,
  });
}

export async function requestTableBill(qr: string, guestKey: string) {
  return rpc<{ requested: boolean }>('public_table_request_bill', { p_qr: qr, p_guest_key: guestKey });
}
