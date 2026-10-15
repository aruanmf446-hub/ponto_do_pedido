import 'server-only';
import { createServerSupabase } from '@/core/supabase/server';

export type FloorTable = { id: string; label: string; sector_id: string | null; seats: number; position: number };
export type OpenTab = {
  id: string;
  number: number;
  table_id: string | null;
  channel: 'salao' | 'balcao' | 'delivery';
  customer_name: string | null;
  guest_count: number | null;
  total_cents: number;
  paid_cents: number;
  bill_requested_at: string | null;
  bill_requested_by: string | null;
  forwarded_to_cashier_at: string | null;
  opened_at: string;
};
export type OrderLite = {
  id: string;
  tab_id: string;
  number: number;
  status: string;
  source: string;
  has_issue: boolean;
  delivery_by: string;
  created_at: string;
  ready_at: string | null;
};

export async function loadFloor(tenantId: string) {
  const supabase = await createServerSupabase();
  const [sectors, tables, tabs, orders] = await Promise.all([
    supabase.from('sectors').select('id, name').eq('tenant_id', tenantId).eq('active', true).eq('kind', 'salao').order('position'),
    supabase.from('dining_tables').select('id, label, sector_id, seats, position').eq('tenant_id', tenantId).eq('active', true).order('position').order('label'),
    supabase
      .from('tabs')
      .select('id, number, table_id, channel, customer_name, guest_count, total_cents, paid_cents, bill_requested_at, bill_requested_by, forwarded_to_cashier_at, opened_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .neq('channel', 'delivery')
      .order('opened_at'),
    supabase
      .from('orders')
      .select('id, tab_id, number, status, source, has_issue, delivery_by, created_at, ready_at')
      .eq('tenant_id', tenantId)
      .in('status', ['pending_confirmation', 'confirmed', 'preparing', 'ready'])
      .neq('source', 'delivery')
      .order('created_at'),
  ]);
  return {
    sectors: (sectors.data ?? []) as { id: string; name: string }[],
    tables: (tables.data ?? []) as FloorTable[],
    tabs: (tabs.data ?? []) as OpenTab[],
    orders: (orders.data ?? []) as OrderLite[],
  };
}

export type MenuProduct = { id: string; category_id: string | null; name: string; description: string; price_cents: number; image_path: string | null; available: boolean };

export async function loadMenu(tenantId: string) {
  const supabase = await createServerSupabase();
  const [categories, products] = await Promise.all([
    supabase.from('categories').select('id, name').eq('tenant_id', tenantId).eq('active', true).order('position').order('name'),
    supabase
      .from('products')
      .select('id, category_id, name, description, price_cents, image_path, available')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .contains('channels', ['salao'])
      .order('position')
      .order('name'),
  ]);
  return { categories: (categories.data ?? []) as { id: string; name: string }[], products: (products.data ?? []) as MenuProduct[] };
}

export type TabDetail = OpenTab & {
  status: string;
  subtotal_cents: number;
  service_fee_cents: number;
  discount_cents: number;
  service_fee_percent: number;
};
export type TabOrder = OrderLite & {
  notes: string | null;
  cancel_reason: string | null;
  items: { id: string; name: string; quantity: number; unit_price_cents: number; notes: string | null; status: string; status_reason: string | null }[];
};

export async function loadTab(tenantId: string, tabId: string) {
  const supabase = await createServerSupabase();
  const [tab, orders, payments, methods] = await Promise.all([
    supabase.from('tabs').select('*').eq('tenant_id', tenantId).eq('id', tabId).maybeSingle(),
    supabase
      .from('orders')
      .select('id, tab_id, number, status, source, has_issue, delivery_by, created_at, ready_at, notes, cancel_reason, items:order_items(id, name, quantity, unit_price_cents, notes, status, status_reason)')
      .eq('tenant_id', tenantId)
      .eq('tab_id', tabId)
      .order('created_at'),
    supabase.from('payments').select('id, amount_cents, method_kind, payer_label, status, received_at').eq('tab_id', tabId).order('received_at'),
    supabase.from('payment_methods').select('id, name, kind').eq('tenant_id', tenantId).eq('active', true).contains('channels', ['atendimento']).order('position'),
  ]);
  return {
    tab: tab.data as TabDetail | null,
    orders: (orders.data ?? []) as TabOrder[],
    payments: (payments.data ?? []) as { id: string; amount_cents: number; method_kind: string; payer_label: string | null; status: string; received_at: string }[],
    methods: (methods.data ?? []) as { id: string; name: string; kind: string }[],
  };
}
