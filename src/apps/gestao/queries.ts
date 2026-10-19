import 'server-only';
import { rpcRead } from '@/core/rpc';
import { createServerSupabase } from '@/core/supabase/server';

// Consultas da Gestão (RLS do projeto operacional).

export async function loadKpis(tenantId: string, from: string, to: string) {
  return rpcRead<Kpis>('management_kpis', { p_tenant: tenantId, p_from: from, p_to: to });
}

export type Kpis = {
  period: { from: string; to: string };
  today: string;
  revenue_cents: number;
  refunded_cents: number;
  closed_tabs: number;
  avg_ticket_cents: number;
  discounts_cents: number;
  service_fee_cents: number;
  orders: number;
  cancelled_orders: number;
  avg_prep_minutes: number;
  by_channel: Record<string, number>;
  by_method: { name: string; kind: string; total_cents: number }[];
  by_day: { day: string; total_cents: number }[];
  top_products: { name: string; quantity: number; total_cents: number }[];
  pending: {
    open_tabs: number;
    open_tabs_previous_days: number;
    receivable_open_cents: number;
    orders_in_production: number;
    orders_ready: number;
    orders_awaiting_confirmation: number;
    approvals: number;
    open_cash_sessions: number;
    cash_divergence_cents: number;
    low_stock: number;
    payables_due_cents: number;
  };
};

export async function loadTenant(tenantId: string) {
  const supabase = await createServerSupabase();
  const [{ data: tenant }, { data: hours }] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', tenantId).single(),
    supabase.from('business_hours').select('weekday, opens, closes').eq('tenant_id', tenantId).order('weekday').order('opens'),
  ]);
  return { tenant: tenant as Record<string, unknown> & { address: Record<string, string> }, hours: hours ?? [] };
}

export async function loadTeam(tenantId: string) {
  const supabase = await createServerSupabase();
  const [members, roles, memberRoles, grants, permissions] = await Promise.all([
    supabase.from('memberships').select('*').eq('tenant_id', tenantId).order('is_owner', { ascending: false }).order('display_name'),
    supabase.from('roles').select('id, name, description').eq('tenant_id', tenantId).order('name'),
    supabase.from('membership_roles').select('membership_id, role_id').eq('tenant_id', tenantId),
    supabase
      .from('member_permissions')
      .select('id, membership_id, permission_code, mode, limit_cents, can_delegate, expires_at, granted_at')
      .eq('tenant_id', tenantId)
      .is('revoked_at', null),
    supabase.from('permissions').select('code, module, label, action, supports_limit, approvable').order('module').order('code'),
  ]);
  const { data: emails } = await supabase.rpc('team_member_emails', { p_tenant: tenantId });
  const byUser = new Map(((emails ?? []) as { user_id: string; email: string }[]).map((item) => [item.user_id, item.email]));
  return {
    members: ((members.data ?? []) as Member[]).map((member) => ({ ...member, email: byUser.get(member.user_id) ?? null })),
    roles: (roles.data ?? []) as Role[],
    memberRoles: (memberRoles.data ?? []) as { membership_id: string; role_id: string }[],
    grants: (grants.data ?? []) as Grant[],
    permissions: (permissions.data ?? []) as Permission[],
  };
}

export type Member = {
  email: string | null;
  id: string;
  user_id: string;
  display_name: string;
  job_title: string | null;
  is_owner: boolean;
  status: 'active' | 'suspended' | 'revoked';
  primary_app: string | null;
  supervisor_membership_id: string | null;
  created_at: string;
};
export type Role = { id: string; name: string; description: string };
export type Grant = {
  id: string;
  membership_id: string;
  permission_code: string;
  mode: 'direct' | 'approval' | 'deny';
  limit_cents: number | null;
  can_delegate: boolean;
  expires_at: string | null;
  granted_at: string;
};
export type Permission = { code: string; module: string; label: string; action: string; supports_limit: boolean; approvable: boolean };

export async function loadRoles(tenantId: string) {
  const supabase = await createServerSupabase();
  const [roles, rolePerms, permissions, memberRoles] = await Promise.all([
    supabase.from('roles').select('id, name, description').eq('tenant_id', tenantId).order('name'),
    supabase.from('role_permissions').select('role_id, permission_code, mode, limit_cents, can_delegate').eq('tenant_id', tenantId),
    supabase.from('permissions').select('code, module, label, action, supports_limit, approvable').order('module').order('code'),
    supabase.from('membership_roles').select('role_id').eq('tenant_id', tenantId),
  ]);
  const usage = new Map<string, number>();
  for (const mr of memberRoles.data ?? []) usage.set(mr.role_id, (usage.get(mr.role_id) ?? 0) + 1);
  return {
    roles: (roles.data ?? []) as Role[],
    rolePerms: (rolePerms.data ?? []) as {
      role_id: string;
      permission_code: string;
      mode: 'direct' | 'approval';
      limit_cents: number | null;
      can_delegate: boolean;
    }[],
    permissions: (permissions.data ?? []) as Permission[],
    usage: Object.fromEntries(usage),
  };
}

export async function loadCatalog(tenantId: string) {
  const supabase = await createServerSupabase();
  const [categories, products, sectors] = await Promise.all([
    supabase.from('categories').select('*').eq('tenant_id', tenantId).order('position').order('name'),
    supabase.from('products').select('*').eq('tenant_id', tenantId).eq('active', true).order('position').order('name'),
    supabase.from('sectors').select('id, name, kind').eq('tenant_id', tenantId).order('name'),
  ]);
  return {
    categories: (categories.data ?? []) as Category[],
    products: (products.data ?? []) as Product[],
    sectors: (sectors.data ?? []) as { id: string; name: string; kind: string }[],
  };
}

export type Category = { id: string; name: string; description: string; position: number; active: boolean };
export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  price_cents: number;
  image_path: string | null;
  available: boolean;
  active: boolean;
  channels: string[];
  prep_sector_id: string | null;
  position: number;
};

export async function loadTables(tenantId: string) {
  const supabase = await createServerSupabase();
  const [sectors, tables, openTabs] = await Promise.all([
    supabase.from('sectors').select('*').eq('tenant_id', tenantId).order('position').order('name'),
    supabase.from('dining_tables').select('*').eq('tenant_id', tenantId).order('position').order('label'),
    supabase.from('tabs').select('table_id').eq('tenant_id', tenantId).eq('status', 'open').not('table_id', 'is', null),
  ]);
  return {
    sectors: (sectors.data ?? []) as { id: string; name: string; kind: string; active: boolean }[],
    tables: (tables.data ?? []) as {
      id: string;
      label: string;
      sector_id: string | null;
      seats: number;
      active: boolean;
      qr_token: string;
      position: number;
    }[],
    occupied: new Set((openTabs.data ?? []).map((t) => t.table_id as string)),
  };
}

export async function loadPayments(tenantId: string) {
  const supabase = await createServerSupabase();
  const [methods, zones, tenant] = await Promise.all([
    supabase.from('payment_methods').select('*').eq('tenant_id', tenantId).order('position').order('name'),
    supabase.from('delivery_zones').select('*').eq('tenant_id', tenantId).order('name'),
    supabase.from('tenants').select('settings').eq('id', tenantId).single(),
  ]);
  return {
    methods: (methods.data ?? []) as { id: string; kind: string; name: string; active: boolean; channels: string[]; position: number }[],
    zones: (zones.data ?? []) as {
      id: string;
      name: string;
      neighborhoods: string[];
      fee_cents: number;
      min_order_cents: number;
      eta_minutes: number | null;
      active: boolean;
    }[],
    settings: (tenant.data?.settings ?? {}) as Record<string, unknown>,
  };
}

export async function loadOperation(tenantId: string) {
  const supabase = await createServerSupabase();
  const [tenant, processes] = await Promise.all([
    supabase.from('tenants').select('settings, slug').eq('id', tenantId).single(),
    supabase.from('process_ownership').select('process, owner, external_system').eq('tenant_id', tenantId),
  ]);
  return {
    settings: (tenant.data?.settings ?? {}) as Record<string, unknown>,
    processes: (processes.data ?? []) as { process: string; owner: 'interno' | 'externo'; external_system: string | null }[],
  };
}

export async function loadHistory(tenantId: string, module: string | null, page: number) {
  const supabase = await createServerSupabase();
  let query = supabase
    .from('audit_log')
    .select('id, at, actor_user_id, module, action, entity, entity_id, approval_id, data', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('at', { ascending: false })
    .range(page * 50, page * 50 + 49);
  if (module) query = query.eq('module', module);
  const [{ data, count }, members] = await Promise.all([
    query,
    supabase.from('memberships').select('user_id, display_name').eq('tenant_id', tenantId),
  ]);
  const names = new Map((members.data ?? []).map((m) => [m.user_id as string, m.display_name as string]));
  return {
    rows: (data ?? []).map((r) => ({ ...r, actor: r.actor_user_id ? (names.get(r.actor_user_id) ?? 'Usuário') : 'Cliente / sistema' })) as {
      id: number;
      at: string;
      actor: string;
      module: string | null;
      action: string;
      entity: string | null;
      entity_id: string | null;
      approval_id: string | null;
      data: Record<string, unknown>;
    }[],
    total: count ?? 0,
  };
}

export async function pendingApprovalsCount(tenantId: string): Promise<number> {
  const items = await rpcRead<{ can_decide: boolean }[]>('approvals_list', { p_tenant: tenantId, p_module: null, p_only_actionable: true });
  return items.length;
}

export type DashboardExtras = {
  team: { total: number; byRole: { name: string; count: number }[] };
  activity: { id: number; at: string; actor: string; action: string; module: string | null }[];
  approvals: { id: string; summary: string; requested_at: string; requester: string; amount_cents: number | null }[];
};

/** Dados complementares do painel: equipe por função, atividade recente e aprovações. */
export async function loadDashboardExtras(tenantId: string): Promise<DashboardExtras> {
  const supabase = await createServerSupabase();
  const [members, roles, memberRoles, audit, approvals] = await Promise.all([
    supabase.from('memberships').select('id, user_id, display_name, is_owner').eq('tenant_id', tenantId).eq('status', 'active'),
    supabase.from('roles').select('id, name').eq('tenant_id', tenantId),
    supabase.from('membership_roles').select('membership_id, role_id').eq('tenant_id', tenantId),
    supabase.from('audit_log').select('id, at, actor_user_id, action, module').eq('tenant_id', tenantId).order('at', { ascending: false }).limit(7),
    supabase.from('approval_requests').select('id, summary, requested_at, requested_by, amount_cents').eq('tenant_id', tenantId).eq('status', 'pending').order('requested_at', { ascending: false }).limit(5),
  ]);
  const people = members.data ?? [];
  const names = new Map(people.map((m) => [m.user_id as string, m.display_name as string]));
  const roleName = new Map((roles.data ?? []).map((r) => [r.id as string, r.name as string]));
  const counts = new Map<string, number>();
  const withRole = new Set<string>();
  for (const mr of memberRoles.data ?? []) {
    const name = roleName.get(mr.role_id as string);
    if (!name) continue;
    withRole.add(mr.membership_id as string);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const owners = people.filter((m) => m.is_owner).length;
  if (owners) counts.set('Titular', owners);
  const unassigned = people.filter((m) => !m.is_owner && !withRole.has(m.id as string)).length;
  if (unassigned) counts.set('Sem função', unassigned);
  return {
    team: { total: people.length, byRole: [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) },
    activity: (audit.data ?? []).map((a) => ({
      id: a.id as number,
      at: a.at as string,
      action: a.action as string,
      module: a.module as string | null,
      actor: a.actor_user_id ? (names.get(a.actor_user_id as string) ?? 'Usuário') : 'Cliente / sistema',
    })),
    approvals: (approvals.data ?? []).map((a) => ({
      id: a.id as string,
      summary: a.summary as string,
      requested_at: a.requested_at as string,
      amount_cents: (a.amount_cents as number | null) ?? null,
      requester: names.get(a.requested_by as string) ?? 'Colaborador',
    })),
  };
}
