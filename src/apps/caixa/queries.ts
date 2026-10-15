import 'server-only';
import { rpcRead } from '@/core/rpc';
import { createServerSupabase } from '@/core/supabase/server';

export type CashSession = {
  id: string;
  operator_id: string;
  status: 'open' | 'closed';
  opening_cents: number;
  opened_at: string;
  business_day: string;
  closed_at: string | null;
  expected: Expected | null;
  counted: Record<string, number> | null;
  divergence_cents: number | null;
  notes: string | null;
};

export type Expected = {
  opening_cents: number;
  movements_cents: number;
  methods: { method_id: string; name: string; kind: string; received_cents: number; refunded_cents: number; expected_cents: number }[];
};

export async function loadOpenSession(tenantId: string, userId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('cash_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('operator_id', userId)
    .eq('status', 'open')
    .maybeSingle();
  return (data as CashSession | null) ?? null;
}

export type Receivable = {
  id: string;
  number: number;
  channel: string;
  customer_name: string | null;
  total_cents: number;
  paid_cents: number;
  bill_requested_at: string | null;
  forwarded_to_cashier_at: string | null;
  opened_at: string;
  table: { label: string } | null;
  delivery: { status: string } | null;
};

export async function loadReceivables(tenantId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('tabs')
    .select('id, number, channel, customer_name, total_cents, paid_cents, bill_requested_at, forwarded_to_cashier_at, opened_at, table:dining_tables(label), delivery:delivery_orders(status)')
    .eq('tenant_id', tenantId)
    .eq('status', 'open')
    .order('forwarded_to_cashier_at', { ascending: true, nullsFirst: false })
    .order('opened_at');
  const rows = (data ?? []) as unknown as Receivable[];
  return rows.filter((r) => r.total_cents - r.paid_cents > 0 && r.delivery?.status !== 'awaiting_acceptance' && r.delivery?.status !== 'rejected');
}

export async function loadCharge(tenantId: string, tabId: string) {
  const supabase = await createServerSupabase();
  const [tab, items, payments, methods] = await Promise.all([
    supabase
      .from('tabs')
      .select('*, table:dining_tables(label), delivery:delivery_orders(status, payment_method_id, change_for_cents, customer_name)')
      .eq('tenant_id', tenantId)
      .eq('id', tabId)
      .maybeSingle(),
    supabase
      .from('order_items')
      .select('name, quantity, unit_price_cents, status, order:orders!inner(tab_id, status)')
      .eq('tenant_id', tenantId)
      .eq('order.tab_id', tabId),
    supabase
      .from('payments')
      .select('id, amount_cents, tendered_cents, change_cents, method_kind, payer_label, status, received_at, receipt_number, refund_reason, method:payment_methods(name)')
      .eq('tab_id', tabId)
      .order('received_at'),
    supabase.from('payment_methods').select('id, name, kind').eq('tenant_id', tenantId).eq('active', true).contains('channels', ['caixa']).order('position'),
  ]);
  const billable = ((items.data ?? []) as unknown as { name: string; quantity: number; unit_price_cents: number; status: string; order: { status: string } }[]).filter(
    (i) => i.status === 'active' && ['confirmed', 'preparing', 'ready', 'delivered'].includes(i.order.status),
  );
  return {
    tab: tab.data as
      | (Receivable & {
          status: string;
          subtotal_cents: number;
          service_fee_cents: number;
          delivery_fee_cents: number;
          discount_cents: number;
          service_fee_percent: number;
        })
      | null,
    items: billable,
    payments: (payments.data ?? []) as unknown as Payment[],
    methods: (methods.data ?? []) as { id: string; name: string; kind: string }[],
  };
}

export type Payment = {
  id: string;
  amount_cents: number;
  tendered_cents: number;
  change_cents: number;
  method_kind: string;
  payer_label: string | null;
  status: string;
  received_at: string;
  receipt_number: number;
  refund_reason: string | null;
  method: { name: string } | null;
};

export async function loadExpected(tenantId: string, sessionId: string) {
  return rpcRead<Expected>('cash_session_expected', { p_tenant: tenantId, p_session: sessionId });
}

export async function loadMovements(tenantId: string, sessionId: string) {
  const supabase = await createServerSupabase();
  const [movements, payments] = await Promise.all([
    supabase.from('cash_movements').select('id, kind, amount_cents, reason, created_at').eq('cash_session_id', sessionId).order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('id, amount_cents, change_cents, method_kind, status, received_at, receipt_number, tab:tabs(number), method:payment_methods(name)')
      .eq('tenant_id', tenantId)
      .or(`cash_session_id.eq.${sessionId},refund_session_id.eq.${sessionId}`)
      .order('received_at', { ascending: false }),
  ]);
  return {
    movements: (movements.data ?? []) as { id: string; kind: string; amount_cents: number; reason: string; created_at: string }[],
    payments: (payments.data ?? []) as unknown as {
      id: string;
      amount_cents: number;
      change_cents: number;
      method_kind: string;
      status: string;
      received_at: string;
      receipt_number: number;
      tab: { number: number } | null;
      method: { name: string } | null;
    }[],
  };
}

export async function loadHistory(tenantId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('cash_sessions')
    .select('id, operator_id, status, opening_cents, opened_at, closed_at, business_day, expected, counted, divergence_cents, notes')
    .eq('tenant_id', tenantId)
    .order('opened_at', { ascending: false })
    .limit(40);
  const { data: members } = await supabase.from('memberships').select('user_id, display_name').eq('tenant_id', tenantId);
  const names = new Map((members ?? []).map((m) => [m.user_id as string, m.display_name as string]));
  return ((data ?? []) as CashSession[]).map((s) => ({ ...s, operator: names.get(s.operator_id) ?? 'Operador' }));
}

export async function loadReceipt(tenantId: string, paymentId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('payments')
    .select('id, amount_cents, tendered_cents, change_cents, method_kind, payer_label, status, received_at, receipt_number, method:payment_methods(name), tab:tabs(number, total_cents, paid_cents, channel, table:dining_tables(label))')
    .eq('tenant_id', tenantId)
    .eq('id', paymentId)
    .maybeSingle();
  return data as unknown as
    | (Payment & { tab: { number: number; total_cents: number; paid_cents: number; channel: string; table: { label: string } | null } | null })
    | null;
}
