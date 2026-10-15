import 'server-only';
import { createServerSupabase } from '@/core/supabase/server';

export type KitchenOrder = {
  id: string;
  number: number;
  status: 'confirmed' | 'preparing' | 'ready' | 'delivered';
  stage: string | null;
  source: string;
  delivery_by: string;
  has_issue: boolean;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  started_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  tab: { number: number; channel: string; customer_name: string | null; table: { label: string } | null } | null;
  items: { id: string; name: string; quantity: number; notes: string | null; status: string; product_id: string | null }[];
};

export async function loadKitchen(tenantId: string) {
  const supabase = await createServerSupabase();
  const since = new Date(Date.now() - 2 * 3600_000).toISOString();
  const [active, delivered, unavailable] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, number, status, stage, source, delivery_by, has_issue, notes, created_at, confirmed_at, started_at, ready_at, delivered_at, tab:tabs(number, channel, customer_name, table:dining_tables(label)), items:order_items(id, name, quantity, notes, status, product_id)',
      )
      .eq('tenant_id', tenantId)
      .in('status', ['confirmed', 'preparing', 'ready'])
      .order('confirmed_at', { ascending: true }),
    supabase
      .from('orders')
      .select(
        'id, number, status, stage, source, delivery_by, has_issue, notes, created_at, confirmed_at, started_at, ready_at, delivered_at, tab:tabs(number, channel, customer_name, table:dining_tables(label)), items:order_items(id, name, quantity, notes, status, product_id)',
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'delivered')
      .gte('delivered_at', since)
      .order('delivered_at', { ascending: false })
      .limit(20),
    supabase.from('products').select('id, name').eq('tenant_id', tenantId).eq('active', true).eq('available', false).order('name'),
  ]);
  return {
    orders: [...((active.data ?? []) as unknown as KitchenOrder[]), ...((delivered.data ?? []) as unknown as KitchenOrder[])],
    unavailable: (unavailable.data ?? []) as { id: string; name: string }[],
  };
}

export async function loadMaterials(tenantId: string) {
  const supabase = await createServerSupabase();
  const [materials, sectors, requests] = await Promise.all([
    supabase.from('materials').select('id, name, unit').eq('tenant_id', tenantId).eq('active', true).order('name'),
    supabase.from('sectors').select('id, name').eq('tenant_id', tenantId).eq('active', true).order('name'),
    supabase
      .from('material_requests')
      .select('id, number, status, requested_at, notes, items:material_request_items(quantity, material:materials(name, unit))')
      .eq('tenant_id', tenantId)
      .order('requested_at', { ascending: false })
      .limit(15),
  ]);
  return {
    materials: (materials.data ?? []) as { id: string; name: string; unit: string }[],
    sectors: (sectors.data ?? []) as { id: string; name: string }[],
    requests: (requests.data ?? []) as unknown as {
      id: string;
      number: number;
      status: string;
      requested_at: string;
      notes: string | null;
      items: { quantity: number; material: { name: string; unit: string } | null }[];
    }[],
  };
}
