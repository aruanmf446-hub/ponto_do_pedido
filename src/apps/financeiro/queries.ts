import 'server-only';
import { addDays } from '@/core/dates';
import { rpcRead } from '@/core/rpc';
import { createServerSupabase } from '@/core/supabase/server';

export type Supplier = { id: string; name: string; document: string | null; contact_name: string | null; phone: string | null; email: string | null; notes: string | null; active: boolean };
export type DocumentRow = {
  id: string;
  kind: string;
  title: string;
  storage_path: string | null;
  amount_cents: number | null;
  issued_on: string | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  supplier: { name: string } | null;
};
export type Payable = {
  id: string;
  kind: string;
  description: string;
  category: string;
  amount_cents: number;
  due_date: string;
  status: 'open' | 'paid' | 'cancelled';
  paid_at: string | null;
  paid_method: string | null;
  supplier: { name: string } | null;
};
export type Receivable = { id: string; customer_name: string; description: string; amount_cents: number; due_date: string; status: string; received_at: string | null };
export type FlowDay = { day: string; sales_cents: number; in_cents: number; out_cents: number; scheduled_out_cents: number; net_cents: number };
export type PurchaseRequest = {
  id: string;
  number: number;
  status: string;
  justification: string;
  needed_by: string | null;
  requested_by: string;
  requested_at: string;
  approved_quotation_id: string | null;
  decision_note: string | null;
  material_request_id: string | null;
  items: { id: string; material_id: string | null; description: string; quantity: number; unit: string }[];
  quotations: { id: string; supplier_id: string; total_cents: number; delivery_days: number | null; valid_until: string | null; payment_terms: string | null; notes: string | null; supplier: { name: string } | null }[];
};
export type PurchaseOrder = {
  id: string;
  number: number;
  status: string;
  total_cents: number;
  expected_on: string | null;
  issued_at: string;
  supplier: { name: string } | null;
  items: { id: string; material_id: string | null; description: string; quantity: number; unit: string; unit_price_cents: number; received_qty: number }[];
};
export type SupplyRequest = {
  id: string;
  number: number;
  status: string;
  notes: string | null;
  needed_by: string | null;
  requested_by: string;
  requested_at: string;
  sector: { name: string } | null;
  items: { quantity: number; material: { name: string; unit: string } | null }[];
};

export function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

async function memberNames(tenantId: string): Promise<Record<string, string>> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('memberships').select('user_id, display_name').eq('tenant_id', tenantId);
  return Object.fromEntries((data ?? []).map((m) => [m.user_id as string, m.display_name as string]));
}

export async function loadOverview(tenantId: string, timezone: string) {
  const supabase = await createServerSupabase();
  const today = todayIn(timezone);
  const [payables, receivables, purchases, reimbursements, supplies, documents, flow] = await Promise.all([
    supabase
      .from('payables')
      .select('id, kind, description, category, amount_cents, due_date, status, paid_at, paid_method, supplier:suppliers(name)')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .lte('due_date', addDays(today, 30))
      .order('due_date'),
    supabase.from('receivables').select('id, customer_name, description, amount_cents, due_date, status, received_at').eq('tenant_id', tenantId).eq('status', 'open').order('due_date'),
    supabase.from('purchase_requests').select('id, number, status, justification, requested_at').eq('tenant_id', tenantId).in('status', ['requested', 'quoting', 'approved']).order('requested_at'),
    supabase.from('reimbursements').select('id, description, amount_cents, status, created_at').eq('tenant_id', tenantId).eq('status', 'requested'),
    supabase.from('material_requests').select('id, number, status, requested_at').eq('tenant_id', tenantId).eq('status', 'requested'),
    supabase.from('documents').select('id, kind, title, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(6),
    rpcRead<FlowDay[]>('cash_flow', { p_tenant: tenantId, p_from: addDays(today, -13), p_to: today }),
  ]);
  return {
    today,
    payables: (payables.data ?? []) as unknown as Payable[],
    receivables: (receivables.data ?? []) as Receivable[],
    purchases: (purchases.data ?? []) as { id: string; number: number; status: string; justification: string; requested_at: string }[],
    reimbursements: (reimbursements.data ?? []) as { id: string; description: string; amount_cents: number; created_at: string }[],
    supplies: (supplies.data ?? []) as { id: string; number: number; requested_at: string }[],
    documents: (documents.data ?? []) as { id: string; kind: string; title: string; created_at: string }[],
    flow,
  };
}

export async function loadSuppliers(tenantId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('suppliers').select('id, name, document, contact_name, phone, email, notes, active').eq('tenant_id', tenantId).order('name');
  return (data ?? []) as Supplier[];
}

export async function loadDocuments(tenantId: string) {
  const supabase = await createServerSupabase();
  const [docs, suppliers] = await Promise.all([
    supabase
      .from('documents')
      .select('id, kind, title, storage_path, amount_cents, issued_on, valid_until, notes, created_at, supplier:suppliers(name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(200),
    loadSuppliers(tenantId),
  ]);
  return { documents: (docs.data ?? []) as unknown as DocumentRow[], suppliers };
}

export async function loadPayables(tenantId: string) {
  const supabase = await createServerSupabase();
  const [rows, suppliers, docs] = await Promise.all([
    supabase
      .from('payables')
      .select('id, kind, description, category, amount_cents, due_date, status, paid_at, paid_method, supplier:suppliers(name)')
      .eq('tenant_id', tenantId)
      .order('status')
      .order('due_date')
      .limit(300),
    loadSuppliers(tenantId),
    supabase.from('documents').select('id, title, kind').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100),
  ]);
  return {
    payables: (rows.data ?? []) as unknown as Payable[],
    suppliers: suppliers.filter((s) => s.active),
    documents: (docs.data ?? []) as { id: string; title: string; kind: string }[],
  };
}

export async function loadReceivables(tenantId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('receivables').select('id, customer_name, description, amount_cents, due_date, status, received_at').eq('tenant_id', tenantId).order('status').order('due_date').limit(300);
  return (data ?? []) as Receivable[];
}

export async function loadPurchases(tenantId: string) {
  const supabase = await createServerSupabase();
  const [requests, orders, suppliers, materials, locations, names] = await Promise.all([
    supabase
      .from('purchase_requests')
      .select(
        'id, number, status, justification, needed_by, requested_by, requested_at, approved_quotation_id, decision_note, material_request_id, items:purchase_request_items(id, material_id, description, quantity, unit), quotations(id, supplier_id, total_cents, delivery_days, valid_until, payment_terms, notes, supplier:suppliers(name))',
      )
      .eq('tenant_id', tenantId)
      .order('requested_at', { ascending: false })
      .limit(80),
    supabase
      .from('purchase_orders')
      .select('id, number, status, total_cents, expected_on, issued_at, supplier:suppliers(name), items:purchase_order_items(id, material_id, description, quantity, unit, unit_price_cents, received_qty)')
      .eq('tenant_id', tenantId)
      .order('issued_at', { ascending: false })
      .limit(80),
    loadSuppliers(tenantId),
    supabase.from('materials').select('id, name, unit').eq('tenant_id', tenantId).eq('active', true).order('name'),
    supabase.from('stock_locations').select('id, name').eq('tenant_id', tenantId).eq('active', true).order('name'),
    memberNames(tenantId),
  ]);
  return {
    requests: (requests.data ?? []) as unknown as PurchaseRequest[],
    orders: (orders.data ?? []) as unknown as PurchaseOrder[],
    suppliers: suppliers.filter((s) => s.active),
    materials: (materials.data ?? []) as { id: string; name: string; unit: string }[],
    locations: (locations.data ?? []) as { id: string; name: string }[],
    names,
  };
}

export async function loadBudgets(tenantId: string, month: string) {
  const supabase = await createServerSupabase();
  const [y, m] = month.split('-').map(Number) as [number, number];
  const end = addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`, -1);
  const [budgets, spent] = await Promise.all([
    supabase.from('budgets').select('category, month, limit_cents').eq('tenant_id', tenantId).eq('month', month).order('category'),
    supabase.from('payables').select('category, amount_cents').eq('tenant_id', tenantId).neq('status', 'cancelled').gte('due_date', month).lte('due_date', end),
  ]);
  const used: Record<string, number> = {};
  for (const p of spent.data ?? []) used[p.category as string] = (used[p.category as string] ?? 0) + Number(p.amount_cents);
  const rows = ((budgets.data ?? []) as { category: string; limit_cents: number }[]).map((b) => ({ ...b, spent_cents: used[b.category] ?? 0 }));
  for (const [category, value] of Object.entries(used)) {
    if (!rows.some((r) => r.category === category)) rows.push({ category, limit_cents: 0, spent_cents: value });
  }
  return rows.sort((a, b) => a.category.localeCompare(b.category));
}

/** O RLS já limita: quem vê o financeiro vê todos; os demais, apenas os próprios. */
export async function loadReimbursements(tenantId: string) {
  const supabase = await createServerSupabase();
  const query = supabase
    .from('reimbursements')
    .select('id, requested_by, description, category, amount_cents, spent_on, status, decision_note, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(150);
  const [rows, names] = await Promise.all([query, memberNames(tenantId)]);
  return {
    rows: (rows.data ?? []) as { id: string; requested_by: string; description: string; category: string; amount_cents: number; spent_on: string; status: string; decision_note: string | null; created_at: string }[],
    names,
  };
}

export async function loadCashFlow(tenantId: string, from: string, to: string) {
  const supabase = await createServerSupabase();
  const [flow, entries] = await Promise.all([
    rpcRead<FlowDay[]>('cash_flow', { p_tenant: tenantId, p_from: from, p_to: to }),
    supabase
      .from('financial_entries')
      .select('id, direction, amount_cents, occurred_on, description, source, reconciled, bank_reference')
      .eq('tenant_id', tenantId)
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('occurred_on', { ascending: false })
      .limit(300),
  ]);
  return {
    flow,
    entries: (entries.data ?? []) as { id: string; direction: 'in' | 'out'; amount_cents: number; occurred_on: string; description: string; source: string; reconciled: boolean; bank_reference: string | null }[],
  };
}

export async function loadSupplies(tenantId: string) {
  const supabase = await createServerSupabase();
  const [rows, names] = await Promise.all([
    supabase
      .from('material_requests')
      .select('id, number, status, notes, needed_by, requested_by, requested_at, sector:sectors(name), items:material_request_items(quantity, material:materials(name, unit))')
      .eq('tenant_id', tenantId)
      .order('requested_at', { ascending: false })
      .limit(80),
    memberNames(tenantId),
  ]);
  return { rows: (rows.data ?? []) as unknown as SupplyRequest[], names };
}
