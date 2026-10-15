-- Solicitações de aprovação para cadastros compartilhados e configurações.

insert into private.approval_kinds (kind, executor) values
  ('tenant.info', 'approver'), ('hours.set', 'approver'), ('sector.save', 'approver'), ('sector.delete', 'approver'),
  ('table.save', 'approver'), ('table.delete', 'approver'), ('table.rotate_qr', 'approver'),
  ('category.save', 'approver'), ('category.delete', 'approver'), ('product.delete', 'approver'),
  ('payment_method.save', 'approver'), ('delivery_zone.save', 'approver'), ('role.save', 'approver'), ('process.set', 'approver')
on conflict (kind) do nothing;

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
    when 'tenant.info' then
      perform public.tenant_update_info(t, a ->> 'name', a ->> 'legal_name', a ->> 'document', a ->> 'phone', a ->> 'email',
        coalesce(a -> 'address', '{}'::jsonb), a ->> 'logo_path', a ->> 'timezone', nullif(a ->> 'business_day_start_hour', '')::smallint);
      return '{}'::jsonb;
    when 'hours.set' then
      perform public.business_hours_set(t, coalesce(a -> 'hours', '[]'::jsonb));
      return '{}'::jsonb;
    when 'sector.save' then
      return jsonb_build_object('id', public.sector_save(t, nullif(a ->> 'id', '')::uuid, a ->> 'name', a ->> 'kind',
        coalesce((a ->> 'active')::boolean, true), coalesce((a ->> 'position')::int, 0)));
    when 'sector.delete' then
      perform public.sector_delete(t, (a ->> 'id')::uuid);
      return '{}'::jsonb;
    when 'table.save' then
      return jsonb_build_object('id', public.table_save(t, nullif(a ->> 'id', '')::uuid, a ->> 'label', nullif(a ->> 'sector', '')::uuid,
        coalesce((a ->> 'seats')::smallint, 4::smallint), coalesce((a ->> 'active')::boolean, true), coalesce((a ->> 'position')::int, 0)));
    when 'table.delete' then
      perform public.table_delete(t, (a ->> 'id')::uuid);
      return '{}'::jsonb;
    when 'table.rotate_qr' then
      return jsonb_build_object('token', public.table_rotate_qr(t, (a ->> 'id')::uuid));
    when 'category.save' then
      return jsonb_build_object('id', public.category_save(t, nullif(a ->> 'id', '')::uuid, a ->> 'name', coalesce(a ->> 'description', ''),
        coalesce((a ->> 'position')::int, 0), coalesce((a ->> 'active')::boolean, true)));
    when 'category.delete' then
      perform public.category_delete(t, (a ->> 'id')::uuid);
      return '{}'::jsonb;
    when 'product.delete' then
      perform public.product_delete(t, (a ->> 'id')::uuid);
      return '{}'::jsonb;
    when 'payment_method.save' then
      return jsonb_build_object('id', public.payment_method_save(t, nullif(a ->> 'id', '')::uuid, a ->> 'kind', a ->> 'name',
        coalesce((a ->> 'active')::boolean, true),
        array(select jsonb_array_elements_text(coalesce(a -> 'channels', '["caixa","atendimento","delivery"]'::jsonb))),
        coalesce((a ->> 'position')::int, 0)));
    when 'delivery_zone.save' then
      return jsonb_build_object('id', public.delivery_zone_save(t, nullif(a ->> 'id', '')::uuid, a ->> 'name',
        array(select jsonb_array_elements_text(coalesce(a -> 'neighborhoods', '[]'::jsonb))),
        coalesce((a ->> 'fee_cents')::bigint, 0), coalesce((a ->> 'min_order_cents')::bigint, 0),
        nullif(a ->> 'eta_minutes', '')::int, coalesce((a ->> 'active')::boolean, true)));
    when 'role.save' then
      return jsonb_build_object('id', public.role_save(t, nullif(a ->> 'id', '')::uuid, a ->> 'name', coalesce(a ->> 'description', ''),
        coalesce(a -> 'permissions', '[]'::jsonb)));
    when 'process.set' then
      perform public.process_ownership_set(t, a ->> 'process', a ->> 'owner', a ->> 'external_system');
      return '{}'::jsonb;
    else
      perform private.fail('INVALID', 'Tipo de solicitação desconhecido.');
  end case;
  return '{}'::jsonb;
end $$;

revoke execute on function private.execute_approval(public.approval_requests) from public, anon, authenticated;
