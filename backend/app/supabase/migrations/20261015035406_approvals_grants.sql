-- Fluxo universal de aprovação e privilégios finais.
--
-- 1. A ação retorna APPROVAL_REQUIRED quando o usuário pode solicitar aprovação.
-- 2. O usuário cria a solicitação (approval_request_create) com o comando e os dados.
-- 3. Um responsável com autoridade direta suficiente aprova ou recusa.
-- 4. Ao aprovar, o sistema revalida (aprovador ainda com autoridade, solicitante
--    ainda ativo) e executa o comando uma única vez. Ações vinculadas ao caixa do
--    solicitante (sangria, estorno) são executadas pelo próprio solicitante.
-- 5. Tudo é registrado na auditoria com solicitante, aprovador e execução.

create or replace function private.authorize(
  p_tenant uuid, p_permission text, p_amount bigint default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_decision text;
  v_approval_id uuid;
  v_req public.approval_requests;
begin
  if (select auth.uid()) is null then
    perform private.fail('AUTH_REQUIRED', 'Sessão expirada. Entre novamente.');
  end if;
  if not private.tenant_operational(p_tenant) then
    perform private.fail('TENANT_INACTIVE', 'Estabelecimento sem assinatura ativa.');
  end if;

  v_approval_id := nullif(current_setting('pdp.approval_id', true), '')::uuid;
  if v_approval_id is not null then
    select * into v_req from public.approval_requests where id = v_approval_id;
    if found and v_req.tenant_id = p_tenant and v_req.permission_code = p_permission
       and v_req.status = 'approved' and v_req.executed_at is null
       and (select auth.uid()) in (v_req.requested_by, v_req.decided_by)
       and (p_amount is null or v_req.amount_cents is null or p_amount <= v_req.amount_cents) then
      if private.evaluate_permission(v_req.decided_by, p_tenant, p_permission, p_amount) <> 'direct'
         and not (p_permission = 'gestao.permissoes.delegar' and private.is_owner(p_tenant)) then
        perform private.fail('APPROVER_REVOKED', 'O responsável que aprovou não possui mais autoridade para esta ação.');
      end if;
      if not exists (select 1 from public.memberships where tenant_id = p_tenant and user_id = v_req.requested_by and status = 'active') then
        perform private.fail('REQUESTER_REVOKED', 'O solicitante não está mais ativo no estabelecimento.');
      end if;
      return v_approval_id;
    end if;
  end if;

  v_decision := private.evaluate_permission((select auth.uid()), p_tenant, p_permission, p_amount);
  if v_decision = 'direct' then
    return null;
  elsif v_decision = 'approval' then
    raise exception using errcode = 'P0001',
      message = 'Esta ação exige aprovação de um responsável.',
      detail = 'APPROVAL_REQUIRED',
      hint = p_permission;
  end if;
  perform private.fail('FORBIDDEN', 'Você não tem permissão para esta ação.');
  return null;
end $$;

-- Ações que podem ser solicitadas, permissão exigida e quem executa após aprovar.
create table private.approval_kinds (
  kind text primary key,
  executor text not null check (executor in ('approver', 'requester'))
);
insert into private.approval_kinds (kind, executor) values
  ('tab.discount', 'approver'),
  ('payment.refund', 'requester'),
  ('cash.sangria', 'requester'),
  ('order.cancel', 'approver'),
  ('order_item.cancel', 'approver'),
  ('tab.transfer', 'approver'),
  ('permission.grant', 'approver'),
  ('member.roles', 'approver'),
  ('member.update', 'approver'),
  ('purchase.decide', 'approver'),
  ('payable.pay', 'approver'),
  ('reimbursement.decide', 'approver'),
  ('stock.out', 'approver'),
  ('inventory.close', 'approver'),
  ('lot.block', 'approver'),
  ('product.save', 'approver'),
  ('settings.update', 'approver'),
  ('budget.set', 'approver');

-- Executa o comando aprovado. Roda com o contexto pdp.approval_id definido.
create or replace function private.execute_approval(p_req public.approval_requests)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t uuid := p_req.tenant_id;
  a jsonb := p_req.payload;
begin
  perform set_config('pdp.approval_id', p_req.id::text, true);
  case p_req.action_kind
    when 'tab.discount' then
      return public.tab_set_discount(t, (a ->> 'tab_id')::uuid, (a ->> 'discount_cents')::bigint, a ->> 'reason');
    when 'payment.refund' then
      return public.payment_refund(t, (a ->> 'payment_id')::uuid, a ->> 'reason');
    when 'cash.sangria' then
      return jsonb_build_object('id', public.cash_movement_register(t, 'sangria', (a ->> 'amount_cents')::bigint, a ->> 'reason', 'apr:' || p_req.id::text));
    when 'order.cancel' then
      return public.order_cancel(t, (a ->> 'order_id')::uuid, a ->> 'reason', coalesce(a ->> 'context', 'atendimento'));
    when 'order_item.cancel' then
      return public.order_item_cancel(t, (a ->> 'item_id')::uuid, a ->> 'reason');
    when 'tab.transfer' then
      return public.tab_transfer(t, (a ->> 'tab_id')::uuid, (a ->> 'to_table_id')::uuid);
    when 'permission.grant' then
      return jsonb_build_object('id', public.member_grant(t, (a ->> 'membership_id')::uuid, a ->> 'code',
        coalesce(a ->> 'mode', 'direct')::public.grant_mode, nullif(a ->> 'limit_cents', '')::bigint,
        coalesce((a ->> 'can_delegate')::boolean, false), nullif(a ->> 'expires_at', '')::timestamptz));
    when 'member.roles' then
      perform public.member_set_roles(t, (a ->> 'membership_id')::uuid,
        array(select jsonb_array_elements_text(a -> 'role_ids')::uuid));
      return '{}'::jsonb;
    when 'member.update' then
      perform public.member_update(t, (a ->> 'membership_id')::uuid, a ->> 'display_name', a ->> 'job_title',
        nullif(a ->> 'primary_app', '')::public.app_module, nullif(a ->> 'supervisor', '')::uuid,
        (a ->> 'status')::public.membership_status);
      return '{}'::jsonb;
    when 'purchase.decide' then
      perform public.purchase_decide(t, (a ->> 'request_id')::uuid, nullif(a ->> 'quotation_id', '')::uuid,
        (a ->> 'approve')::boolean, a ->> 'note');
      return '{}'::jsonb;
    when 'payable.pay' then
      perform public.payable_pay(t, (a ->> 'payable_id')::uuid, a ->> 'paid_method', nullif(a ->> 'proof_document', '')::uuid);
      return '{}'::jsonb;
    when 'reimbursement.decide' then
      perform public.reimbursement_decide(t, (a ->> 'reimbursement_id')::uuid, (a ->> 'approve')::boolean, a ->> 'note');
      return '{}'::jsonb;
    when 'stock.out' then
      perform public.stock_out(t, (a ->> 'lot_id')::uuid, a ->> 'kind', (a ->> 'qty')::numeric, a ->> 'reason', 'apr:' || p_req.id::text);
      return '{}'::jsonb;
    when 'inventory.close' then
      return public.inventory_close(t, (a ->> 'count_id')::uuid);
    when 'lot.block' then
      perform public.stock_lot_block(t, (a ->> 'lot_id')::uuid, (a ->> 'blocked')::boolean, a ->> 'reason');
      return '{}'::jsonb;
    when 'product.save' then
      return jsonb_build_object('id', public.product_save(t, nullif(a ->> 'id', '')::uuid, nullif(a ->> 'category_id', '')::uuid,
        a ->> 'name', a ->> 'description', (a ->> 'price_cents')::bigint, a ->> 'image_path',
        (a ->> 'available')::boolean, (a ->> 'active')::boolean,
        array(select jsonb_array_elements_text(coalesce(a -> 'channels', '["salao","cardapio","delivery"]'::jsonb))),
        nullif(a ->> 'prep_sector_id', '')::uuid, coalesce((a ->> 'position')::int, 0)));
    when 'settings.update' then
      return public.tenant_update_settings(t, a -> 'patch');
    when 'budget.set' then
      perform public.budget_set(t, a ->> 'category', (a ->> 'month')::date, (a ->> 'limit_cents')::bigint);
      return '{}'::jsonb;
    else
      perform private.fail('INVALID', 'Tipo de solicitação desconhecido.');
  end case;
  return '{}'::jsonb;
end $$;

create or replace function public.approval_request_create(
  p_tenant uuid, p_permission text, p_action_kind text, p_summary text, p_amount_cents bigint, p_payload jsonb, p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_perm public.permissions;
  v_id uuid;
  v_decision text;
begin
  if (select auth.uid()) is null then perform private.fail('AUTH_REQUIRED', 'Sessão expirada.'); end if;
  if not private.tenant_operational(p_tenant) then perform private.fail('TENANT_INACTIVE', 'Estabelecimento inativo.'); end if;
  select * into v_perm from public.permissions where code = p_permission;
  if not found then perform private.fail('INVALID', 'Permissão inválida.'); end if;
  if not exists (select 1 from private.approval_kinds where kind = p_action_kind) then
    perform private.fail('INVALID', 'Esta ação não pode ser solicitada.');
  end if;
  v_decision := private.evaluate_permission((select auth.uid()), p_tenant, p_permission, p_amount_cents);
  -- Gestor sem poder de delegar solicita ao titular
  if p_permission = 'gestao.permissoes.delegar' then
    if private.evaluate_permission((select auth.uid()), p_tenant, 'gestao.permissoes.alterar') <> 'direct' then
      perform private.fail('FORBIDDEN', 'Você não pode solicitar alterações de permissão.');
    end if;
  elsif v_decision = 'direct' then
    perform private.fail('NOT_NEEDED', 'Você já possui autoridade para esta ação.');
  elsif v_decision = 'deny' then
    perform private.fail('FORBIDDEN', 'Esta ação está bloqueada para você e não pode ser solicitada.');
  end if;
  if exists (select 1 from public.approval_requests where tenant_id = p_tenant and requested_by = (select auth.uid())
             and action_kind = p_action_kind and payload = coalesce(p_payload, '{}'::jsonb) and status = 'pending' and expires_at > now()) then
    perform private.fail('DUPLICATE', 'Já existe uma solicitação igual aguardando decisão.');
  end if;
  insert into public.approval_requests (tenant_id, module, permission_code, action_kind, summary, amount_cents, payload, reason, requested_by)
    values (p_tenant, v_perm.module, p_permission, p_action_kind, left(trim(p_summary), 300), p_amount_cents,
      coalesce(p_payload, '{}'::jsonb), nullif(trim(coalesce(p_reason, '')), ''), (select auth.uid()))
    returning id into v_id;
  perform private.audit(p_tenant, v_perm.module, 'approval.requested', 'approval_request', v_id::text,
    jsonb_build_object('permission', p_permission, 'kind', p_action_kind, 'amount_cents', p_amount_cents, 'summary', p_summary));
  return v_id;
end $$;

-- O usuário atual pode decidir esta solicitação?
create or replace function private.can_decide(p_req public.approval_requests)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_req.requested_by <> (select auth.uid())
    and (
      (p_req.permission_code = 'gestao.permissoes.delegar' and private.is_owner(p_req.tenant_id))
      or (p_req.permission_code <> 'gestao.permissoes.delegar'
          and private.evaluate_permission((select auth.uid()), p_req.tenant_id, p_req.permission_code, p_req.amount_cents) = 'direct')
    )
$$;

create or replace function public.approval_decide(p_tenant uuid, p_request uuid, p_approve boolean, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_req public.approval_requests;
  v_executor text;
  v_result jsonb;
  v_err text;
begin
  if (select auth.uid()) is null then perform private.fail('AUTH_REQUIRED', 'Sessão expirada.'); end if;
  select * into v_req from public.approval_requests where id = p_request and tenant_id = p_tenant for update;
  if not found then perform private.fail('NOT_FOUND', 'Solicitação não encontrada.'); end if;
  if v_req.status <> 'pending' then perform private.fail('INVALID_STATE', 'Esta solicitação já foi decidida.'); end if;
  if v_req.expires_at <= now() then
    update public.approval_requests set status = 'cancelled', decision_note = 'Expirada' where id = p_request;
    perform private.fail('EXPIRED', 'A solicitação expirou.');
  end if;
  if not private.can_decide(v_req) then
    perform private.fail('FORBIDDEN', 'Você não possui autoridade suficiente para decidir esta solicitação.');
  end if;

  update public.approval_requests set status = case when p_approve then 'approved' else 'rejected' end::public.approval_status,
    decided_by = (select auth.uid()), decided_at = now(), decision_note = nullif(trim(coalesce(p_note, '')), '')
    where id = p_request returning * into v_req;
  perform private.audit(p_tenant, v_req.module, case when p_approve then 'approval.approved' else 'approval.rejected' end,
    'approval_request', p_request::text, jsonb_build_object('summary', v_req.summary, 'note', p_note), p_request);

  if not p_approve then
    return to_jsonb(v_req);
  end if;
  select executor into v_executor from private.approval_kinds where kind = v_req.action_kind;
  if v_executor = 'requester' then
    return to_jsonb(v_req);
  end if;

  begin
    v_result := private.execute_approval(v_req);
    update public.approval_requests set status = 'executed', executed_at = now(), result = v_result where id = p_request
      returning * into v_req;
    perform private.audit(p_tenant, v_req.module, 'approval.executed', 'approval_request', p_request::text, '{}'::jsonb, p_request);
  exception when others then
    get stacked diagnostics v_err = message_text;
    update public.approval_requests set status = 'failed', error = v_err where id = p_request returning * into v_req;
  end;
  perform set_config('pdp.approval_id', '', true);
  return to_jsonb(v_req);
end $$;

-- Execução pelo solicitante (ações vinculadas ao próprio caixa).
create or replace function public.approval_execute(p_tenant uuid, p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_req public.approval_requests;
  v_result jsonb;
begin
  select * into v_req from public.approval_requests where id = p_request and tenant_id = p_tenant for update;
  if not found then perform private.fail('NOT_FOUND', 'Solicitação não encontrada.'); end if;
  if v_req.requested_by <> (select auth.uid()) then
    perform private.fail('FORBIDDEN', 'Somente o solicitante executa esta ação.');
  end if;
  if v_req.status <> 'approved' or v_req.executed_at is not null then
    perform private.fail('INVALID_STATE', 'A solicitação não está aprovada para execução.');
  end if;
  v_result := private.execute_approval(v_req);
  update public.approval_requests set status = 'executed', executed_at = now(), result = v_result where id = p_request
    returning * into v_req;
  perform private.audit(p_tenant, v_req.module, 'approval.executed', 'approval_request', p_request::text, '{}'::jsonb, p_request);
  perform set_config('pdp.approval_id', '', true);
  return to_jsonb(v_req);
end $$;

create or replace function public.approval_cancel(p_tenant uuid, p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.approval_requests set status = 'cancelled'
    where id = p_request and tenant_id = p_tenant and requested_by = (select auth.uid()) and status in ('pending', 'approved')
      and executed_at is null;
  if not found then perform private.fail('INVALID_STATE', 'Não é possível cancelar esta solicitação.'); end if;
  perform private.audit(p_tenant, null, 'approval.cancelled', 'approval_request', p_request::text);
end $$;

-- Solicitações visíveis com indicação de quem pode decidir.
create or replace function public.approvals_list(p_tenant uuid, p_module public.app_module default null, p_only_actionable boolean default false)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'module', r.module, 'permission_code', r.permission_code, 'permission_label', p.label,
    'action_kind', r.action_kind, 'summary', r.summary, 'amount_cents', r.amount_cents, 'reason', r.reason,
    'status', case when r.status = 'pending' and r.expires_at <= now() then 'expired' else r.status::text end,
    'requested_by', r.requested_by, 'requested_by_name', rm.display_name, 'requested_at', r.requested_at,
    'decided_by_name', dm.display_name, 'decided_at', r.decided_at, 'decision_note', r.decision_note,
    'executed_at', r.executed_at, 'error', r.error, 'expires_at', r.expires_at,
    'is_mine', r.requested_by = (select auth.uid()),
    'can_decide', r.status = 'pending' and r.expires_at > now() and private.can_decide(r),
    'can_execute', r.status = 'approved' and r.executed_at is null and r.requested_by = (select auth.uid())
  ) order by r.requested_at desc), '[]'::jsonb)
  from public.approval_requests r
  join public.permissions p on p.code = r.permission_code
  left join public.memberships rm on rm.tenant_id = r.tenant_id and rm.user_id = r.requested_by
  left join public.memberships dm on dm.tenant_id = r.tenant_id and dm.user_id = r.decided_by
  where r.tenant_id = p_tenant and private.is_member(p_tenant)
    and (p_module is null or r.module = p_module)
    and r.requested_at > now() - interval '30 days'
    and (not p_only_actionable or (r.status = 'pending' and r.expires_at > now() and private.can_decide(r)))
$$;

-- ---------------------------------------------------------------------------
-- Privilégios finais
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on public.ui_preferences to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
revoke all on all tables in schema private from anon, authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.admin_sync_license(uuid, uuid, text, text, public.tenant_status, text, timestamptz, public.app_module[]) from authenticated;
revoke execute on function public.admin_find_user_by_email(text) from authenticated;
revoke execute on function public.admin_attach_member(uuid, uuid, uuid, text, text, public.app_module, uuid[], boolean) from authenticated;

grant execute on function public.slug_available(text) to anon;
grant execute on function public.tenant_public_info(text) to anon;
grant execute on function public.my_context(text) to anon;
grant execute on function public.public_table_menu(text, text) to anon;
grant execute on function public.public_menu(text) to anon;
grant execute on function public.public_table_order(text, text, jsonb, text, text) to anon;
grant execute on function public.public_table_request_bill(text, text) to anon;
grant execute on function public.public_delivery_menu(text) to anon;
grant execute on function public.public_delivery_order(text, jsonb, jsonb, uuid, jsonb, text, uuid, bigint, text) to anon;
grant execute on function public.public_delivery_tracking(text) to anon;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member(uuid), private.is_owner(uuid), private.tenant_operational(uuid),
  private.module_enabled(uuid, public.app_module), private.evaluate_permission(uuid, uuid, text, bigint),
  private.can_view_finance(uuid)
  to authenticated;

alter default privileges in schema public revoke execute on functions from public, anon;
