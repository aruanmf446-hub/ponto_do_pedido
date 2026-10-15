'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isInternalApp, isVisualModel, type ColorScheme } from '@/core/apps';
import { failure, ok, type ActionResult } from '@/core/errors';
import { rpc } from '@/core/rpc';
import { createServerSupabase } from '@/core/supabase/server';

// Ações compartilhadas por todos os aplicativos (núcleo).

export async function saveUiPreference(tenantId: string, app: string, model: string, scheme: ColorScheme): Promise<ActionResult<null>> {
  if (!isInternalApp(app) || !isVisualModel(model) || !['light', 'dark', 'system'].includes(scheme)) {
    return failure('INVALID', 'Preferência inválida.');
  }
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return failure('AUTH_REQUIRED', 'Sessão expirada.');
  const { error } = await supabase
    .from('ui_preferences')
    .upsert({ user_id: user.user.id, tenant_id: tenantId, app, model, scheme, updated_at: new Date().toISOString() });
  if (error) return failure('ERROR', 'Não foi possível salvar a preferência.');
  return ok(null);
}

export type ApprovalRequestInput = {
  tenantId: string;
  permission: string;
  kind: string;
  summary: string;
  amountCents: number | null;
  payload: Record<string, unknown>;
  reason: string;
};

export async function requestApproval(input: ApprovalRequestInput): Promise<ActionResult<string>> {
  return rpc<string>('approval_request_create', {
    p_tenant: input.tenantId,
    p_permission: input.permission,
    p_action_kind: input.kind,
    p_summary: input.summary,
    p_amount_cents: input.amountCents,
    p_payload: input.payload,
    p_reason: input.reason,
  });
}

export async function decideApproval(tenantId: string, requestId: string, approve: boolean, note: string) {
  return rpc<{ status: string; error: string | null }>('approval_decide', {
    p_tenant: tenantId,
    p_request: requestId,
    p_approve: approve,
    p_note: note,
  });
}

export async function executeApproval(tenantId: string, requestId: string) {
  return rpc<{ status: string }>('approval_execute', { p_tenant: tenantId, p_request: requestId });
}

export async function cancelApproval(tenantId: string, requestId: string) {
  return rpc<null>('approval_cancel', { p_tenant: tenantId, p_request: requestId });
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  const base = (await headers()).get('x-pdp-base') ?? '';
  redirect(`${base}/`);
}
