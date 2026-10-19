'use server';

import { config } from '@/core/config';
import { failure, ok, type ActionResult } from '@/core/errors';
import { rpc } from '@/core/rpc';
import { getAccessToken } from '@/core/supabase/server';

// Ações da Gestão. Toda autorização (módulo, permissão, limite, delegação)
// é validada pelo banco; aqui apenas repassamos os dados.

export async function saveTenantInfo(
  tenantId: string,
  input: {
    name: string;
    legal_name: string;
    document: string;
    phone: string;
    email: string;
    address: Record<string, string>;
    logo_path: string | null;
    timezone: string;
    business_day_start_hour: number;
  },
) {
  return rpc<null>('tenant_update_info', {
    p_tenant: tenantId,
    p_name: input.name,
    p_legal_name: input.legal_name || null,
    p_document: input.document || null,
    p_phone: input.phone || null,
    p_email: input.email || null,
    p_address: input.address,
    p_logo_path: input.logo_path,
    p_timezone: input.timezone,
    p_business_day_start_hour: input.business_day_start_hour,
  });
}

export async function saveBusinessHours(tenantId: string, hours: { weekday: number; opens: string; closes: string }[]) {
  return rpc<null>('business_hours_set', { p_tenant: tenantId, p_hours: hours });
}

export async function saveSettings(tenantId: string, patch: Record<string, unknown>) {
  return rpc<Record<string, unknown>>('tenant_update_settings', { p_tenant: tenantId, p_patch: patch });
}

export async function setProcessOwnership(tenantId: string, process: string, owner: 'interno' | 'externo', externalSystem: string) {
  return rpc<null>('process_ownership_set', {
    p_tenant: tenantId,
    p_process: process,
    p_owner: owner,
    p_external_system: externalSystem,
  });
}

export async function saveSector(tenantId: string, input: { id: string | null; name: string; kind: string; active: boolean }) {
  return rpc<string>('sector_save', {
    p_tenant: tenantId,
    p_id: input.id,
    p_name: input.name,
    p_kind: input.kind,
    p_active: input.active,
    p_position: 0,
  });
}

export async function deleteSector(tenantId: string, id: string) {
  return rpc<null>('sector_delete', { p_tenant: tenantId, p_id: id });
}

export async function saveTable(
  tenantId: string,
  input: { id: string | null; label: string; sector: string | null; seats: number; active: boolean; position: number },
) {
  return rpc<string>('table_save', {
    p_tenant: tenantId,
    p_id: input.id,
    p_label: input.label,
    p_sector: input.sector,
    p_seats: input.seats,
    p_active: input.active,
    p_position: input.position,
  });
}

export async function deleteTable(tenantId: string, id: string) {
  return rpc<null>('table_delete', { p_tenant: tenantId, p_id: id });
}

export async function rotateTableQr(tenantId: string, id: string) {
  return rpc<string>('table_rotate_qr', { p_tenant: tenantId, p_id: id });
}

export async function saveCategory(tenantId: string, input: { id: string | null; name: string; description: string; position: number; active: boolean }) {
  return rpc<string>('category_save', {
    p_tenant: tenantId,
    p_id: input.id,
    p_name: input.name,
    p_description: input.description,
    p_position: input.position,
    p_active: input.active,
  });
}

export async function deleteCategory(tenantId: string, id: string) {
  return rpc<null>('category_delete', { p_tenant: tenantId, p_id: id });
}

export type ProductInput = {
  id: string | null;
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

export async function saveProduct(tenantId: string, input: ProductInput) {
  return rpc<string>('product_save', {
    p_tenant: tenantId,
    p_id: input.id,
    p_category: input.category_id,
    p_name: input.name,
    p_description: input.description,
    p_price_cents: input.price_cents,
    p_image_path: input.image_path,
    p_available: input.available,
    p_active: input.active,
    p_channels: input.channels,
    p_prep_sector: input.prep_sector_id,
    p_position: input.position,
  });
}

export async function deleteProduct(tenantId: string, id: string) {
  return rpc<null>('product_delete', { p_tenant: tenantId, p_id: id });
}

export async function savePaymentMethod(
  tenantId: string,
  input: { id: string | null; kind: string; name: string; active: boolean; channels: string[]; position: number },
) {
  return rpc<string>('payment_method_save', {
    p_tenant: tenantId,
    p_id: input.id,
    p_kind: input.kind,
    p_name: input.name,
    p_active: input.active,
    p_channels: input.channels,
    p_position: input.position,
  });
}

export async function saveDeliveryZone(
  tenantId: string,
  input: {
    id: string | null;
    name: string;
    neighborhoods: string[];
    fee_cents: number;
    min_order_cents: number;
    eta_minutes: number | null;
    active: boolean;
  },
) {
  return rpc<string>('delivery_zone_save', {
    p_tenant: tenantId,
    p_id: input.id,
    p_name: input.name,
    p_neighborhoods: input.neighborhoods,
    p_fee_cents: input.fee_cents,
    p_min_order_cents: input.min_order_cents,
    p_eta_minutes: input.eta_minutes,
    p_active: input.active,
  });
}

export type RolePermissionInput = { code: string; mode: 'direct' | 'approval'; limit_cents: number | null; can_delegate: boolean };

export async function saveRole(tenantId: string, input: { id: string | null; name: string; description: string; permissions: RolePermissionInput[] }) {
  return rpc<string>('role_save', {
    p_tenant: tenantId,
    p_role_id: input.id,
    p_name: input.name,
    p_description: input.description,
    p_permissions: input.permissions,
  });
}

export async function deleteRole(tenantId: string, id: string) {
  return rpc<null>('role_delete', { p_tenant: tenantId, p_role_id: id });
}

export async function updateMember(
  tenantId: string,
  input: { id: string; display_name: string; job_title: string; primary_app: string | null; supervisor: string | null; status: string },
) {
  return rpc<null>('member_update', {
    p_tenant: tenantId,
    p_membership_id: input.id,
    p_display_name: input.display_name,
    p_job_title: input.job_title || null,
    p_primary_app: input.primary_app,
    p_supervisor: input.supervisor,
    p_status: input.status,
  });
}

export async function setMemberRoles(tenantId: string, membershipId: string, roleIds: string[]) {
  return rpc<null>('member_set_roles', { p_tenant: tenantId, p_membership_id: membershipId, p_role_ids: roleIds });
}

export async function grantPermission(
  tenantId: string,
  input: { membership_id: string; code: string; mode: 'direct' | 'approval' | 'deny'; limit_cents: number | null; can_delegate: boolean; expires_at: string | null },
) {
  return rpc<string>('member_grant', {
    p_tenant: tenantId,
    p_membership_id: input.membership_id,
    p_code: input.code,
    p_mode: input.mode,
    p_limit_cents: input.limit_cents,
    p_can_delegate: input.can_delegate,
    p_expires_at: input.expires_at,
  });
}

export async function revokePermission(tenantId: string, grantId: string) {
  return rpc<null>('member_revoke', { p_tenant: tenantId, p_grant_id: grantId });
}

/** Cadastro de colaborador pela Edge Function `team` (sem contas duplicadas). */
export async function createMember(
  tenantId: string,
  input: { email: string; full_name: string; job_title: string; primary_app: string; role_ids: string[]; temporary_password: string },
): Promise<ActionResult<{ created_account: boolean; email_sent: boolean }>> {
  const token = await getAccessToken();
  if (!token) return failure('AUTH_REQUIRED', 'Sessão expirada. Entre novamente.');
  try {
    const res = await fetch(`${config.app.url}/functions/v1/team`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: config.app.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, ...input }),
      cache: 'no-store',
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.error) return failure(body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Não foi possível cadastrar.');
    return ok({ created_account: !!body.created_account, email_sent: !!body.email_sent });
  } catch {
    return failure('UNAVAILABLE', 'Serviço de cadastro indisponível. Tente novamente.');
  }
}

export async function markOnboardingStep(tenantId: string, step: string) {
  return rpc<null>('onboarding_mark', { p_tenant: tenantId, p_step: step, p_status: 'done' });
}
