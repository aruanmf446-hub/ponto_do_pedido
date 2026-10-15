import 'server-only';
import { rpcRead } from '@/core/rpc';
import { createServerSupabase } from '@/core/supabase/server';

export type OverviewRow = {
  material_id: string;
  name: string;
  category: string;
  unit: string;
  min_qty: number;
  reorder_qty: number;
  perishable: boolean;
  available_qty: number;
  blocked_qty: number;
  expired_qty: number;
  expiring_qty: number;
  next_expiry: string | null;
  below_min: boolean;
};
export type Lot = {
  id: string;
  lot_code: string | null;
  expires_on: string | null;
  qty: number;
  status: 'available' | 'blocked';
  block_reason: string | null;
  unit_cost_cents: number | null;
  received_at: string;
  material: { id: string; name: string; unit: string } | null;
  location: { id: string; name: string } | null;
};
export type Material = { id: string; name: string; category: string; unit: string; sku: string | null; min_qty: number; reorder_qty: number; perishable: boolean; active: boolean };
export type Location = { id: string; name: string; kind: string; active: boolean };
export type MaterialRequest = {
  id: string;
  number: number;
  status: string;
  notes: string | null;
  needed_by: string | null;
  requested_by: string;
  requested_at: string;
  decision_note: string | null;
  sector: { name: string } | null;
  items: { quantity: number; fulfilled_qty: number; material_id: string; material: { name: string; unit: string } | null }[];
};
export type Movement = {
  id: string;
  kind: string;
  qty: number;
  reason: string | null;
  created_at: string;
  created_by: string;
  material: { name: string; unit: string } | null;
  from: { name: string } | null;
  to: { name: string } | null;
};

export function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const LOT_SELECT = 'id, lot_code, expires_on, qty, status, block_reason, unit_cost_cents, received_at, material:materials(id, name, unit), location:stock_locations(id, name)';
const MOVE_SELECT = 'id, kind, qty, reason, created_at, created_by, material:materials(name, unit), from:stock_locations!stock_movements_from_location_id_fkey(name), to:stock_locations!stock_movements_to_location_id_fkey(name)';
const REQ_SELECT =
  'id, number, status, notes, needed_by, requested_by, requested_at, decision_note, sector:sectors(name), items:material_request_items(quantity, fulfilled_qty, material_id, material:materials(name, unit))';

export async function memberNames(tenantId: string): Promise<Record<string, string>> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('memberships').select('user_id, display_name').eq('tenant_id', tenantId);
  return Object.fromEntries((data ?? []).map((m) => [m.user_id as string, m.display_name as string]));
}

export async function loadOverview(tenantId: string) {
  const supabase = await createServerSupabase();
  const [rows, lots, requests, moves, counts, names] = await Promise.all([
    rpcRead<OverviewRow[]>('stock_overview', { p_tenant: tenantId }),
    supabase.from('stock_lots').select(LOT_SELECT).eq('tenant_id', tenantId).gt('qty', 0).not('expires_on', 'is', null).order('expires_on').limit(40),
    supabase.from('material_requests').select(REQ_SELECT).eq('tenant_id', tenantId).in('status', ['requested', 'authorized']).order('requested_at'),
    supabase.from('stock_movements').select(MOVE_SELECT).eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(15),
    supabase.from('inventory_counts').select('id, status, started_at, closed_at, location:stock_locations(name)').eq('tenant_id', tenantId).order('started_at', { ascending: false }).limit(3),
    memberNames(tenantId),
  ]);
  return {
    rows,
    lots: (lots.data ?? []) as unknown as Lot[],
    requests: (requests.data ?? []) as unknown as MaterialRequest[],
    moves: (moves.data ?? []) as unknown as Movement[],
    counts: (counts.data ?? []) as unknown as { id: string; status: string; started_at: string; closed_at: string | null; location: { name: string } | null }[],
    names,
  };
}

export async function loadLots(tenantId: string) {
  const supabase = await createServerSupabase();
  const [lots, locations] = await Promise.all([
    supabase.from('stock_lots').select(LOT_SELECT).eq('tenant_id', tenantId).gt('qty', 0).order('expires_on', { ascending: true, nullsFirst: false }).limit(400),
    supabase.from('stock_locations').select('id, name, kind, active').eq('tenant_id', tenantId).eq('active', true).order('name'),
  ]);
  return { lots: (lots.data ?? []) as unknown as Lot[], locations: (locations.data ?? []) as Location[] };
}

export async function loadRegistry(tenantId: string) {
  const supabase = await createServerSupabase();
  const [materials, locations] = await Promise.all([
    supabase.from('materials').select('id, name, category, unit, sku, min_qty, reorder_qty, perishable, active').eq('tenant_id', tenantId).order('name'),
    supabase.from('stock_locations').select('id, name, kind, active').eq('tenant_id', tenantId).order('name'),
  ]);
  return { materials: (materials.data ?? []) as Material[], locations: (locations.data ?? []) as Location[] };
}

export async function loadEntry(tenantId: string) {
  const supabase = await createServerSupabase();
  const [registry, orders, recent] = await Promise.all([
    loadRegistry(tenantId),
    supabase
      .from('purchase_orders')
      .select('id, number, status, expected_on, supplier:suppliers(name), items:purchase_order_items(id, material_id, description, quantity, unit, received_qty)')
      .eq('tenant_id', tenantId)
      .in('status', ['issued', 'partially_received'])
      .order('expected_on', { ascending: true, nullsFirst: false }),
    supabase.from('stock_movements').select(MOVE_SELECT).eq('tenant_id', tenantId).eq('kind', 'entrada').order('created_at', { ascending: false }).limit(12),
  ]);
  return {
    materials: registry.materials.filter((m) => m.active),
    locations: registry.locations.filter((l) => l.active),
    orders: (orders.data ?? []) as unknown as {
      id: string;
      number: number;
      status: string;
      expected_on: string | null;
      supplier: { name: string } | null;
      items: { id: string; material_id: string | null; description: string; quantity: number; unit: string; received_qty: number }[];
    }[],
    recent: (recent.data ?? []) as unknown as Movement[],
  };
}

export async function loadRequests(tenantId: string) {
  const supabase = await createServerSupabase();
  const [rows, names, overview, sectors] = await Promise.all([
    supabase.from('material_requests').select(REQ_SELECT).eq('tenant_id', tenantId).order('requested_at', { ascending: false }).limit(80),
    memberNames(tenantId),
    rpcRead<OverviewRow[]>('stock_overview', { p_tenant: tenantId }),
    supabase.from('sectors').select('id, name').eq('tenant_id', tenantId).eq('active', true).order('name'),
  ]);
  const available = Object.fromEntries(overview.map((o) => [o.material_id, Number(o.available_qty)]));
  return {
    rows: (rows.data ?? []) as unknown as MaterialRequest[],
    names,
    available,
    materials: overview.map((o) => ({ id: o.material_id, name: o.name, unit: o.unit })),
    sectors: (sectors.data ?? []) as { id: string; name: string }[],
  };
}

export async function loadInventory(tenantId: string) {
  const supabase = await createServerSupabase();
  const [counts, locations] = await Promise.all([
    supabase
      .from('inventory_counts')
      .select('id, status, notes, started_at, closed_at, location:stock_locations(name), lines:inventory_count_lines(id, expected_qty, counted_qty, lot:stock_lots(lot_code, expires_on, location:stock_locations(name)), material:materials(name, unit))')
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(10),
    supabase.from('stock_locations').select('id, name, kind, active').eq('tenant_id', tenantId).eq('active', true).order('name'),
  ]);
  return {
    counts: (counts.data ?? []) as unknown as {
      id: string;
      status: string;
      notes: string | null;
      started_at: string;
      closed_at: string | null;
      location: { name: string } | null;
      lines: {
        id: string;
        expected_qty: number;
        counted_qty: number | null;
        lot: { lot_code: string | null; expires_on: string | null; location: { name: string } | null } | null;
        material: { name: string; unit: string } | null;
      }[];
    }[],
    locations: (locations.data ?? []) as Location[],
  };
}

export async function loadMovements(tenantId: string, kind: string | null) {
  const supabase = await createServerSupabase();
  let q = supabase.from('stock_movements').select(MOVE_SELECT).eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200);
  if (kind) q = q.eq('kind', kind);
  const [rows, names] = await Promise.all([q, memberNames(tenantId)]);
  return { rows: (rows.data ?? []) as unknown as Movement[], names };
}
