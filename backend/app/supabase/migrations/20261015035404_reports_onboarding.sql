-- Indicadores da Gestão (por dia operacional) e primeiro acesso.

create or replace function public.management_kpis(p_tenant uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  if not private.is_owner(p_tenant)
     and private.evaluate_permission((select auth.uid()), p_tenant, 'gestao.indicadores.visualizar') <> 'direct' then
    perform private.fail('FORBIDDEN', 'Você não tem acesso aos indicadores.');
  end if;
  if p_to < p_from or p_to - p_from > 366 then
    perform private.fail('INVALID', 'Período inválido.');
  end if;

  with pay as (
    select * from public.payments where tenant_id = p_tenant and business_day between p_from and p_to
  ), closed_tabs as (
    select * from public.tabs where tenant_id = p_tenant and business_day between p_from and p_to and status = 'closed'
  ), ord as (
    select * from public.orders where tenant_id = p_tenant and business_day between p_from and p_to
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'revenue_cents', (select coalesce(sum(amount_cents), 0) from pay where status = 'confirmed'),
    'refunded_cents', (select coalesce(sum(amount_cents), 0) from pay where status = 'refunded'),
    'closed_tabs', (select count(*) from closed_tabs),
    'avg_ticket_cents', (select coalesce(round(avg(total_cents)), 0) from closed_tabs),
    'discounts_cents', (select coalesce(sum(discount_cents), 0) from closed_tabs),
    'service_fee_cents', (select coalesce(sum(service_fee_cents), 0) from closed_tabs),
    'orders', (select count(*) from ord where status not in ('cancelled', 'rejected')),
    'cancelled_orders', (select count(*) from ord where status in ('cancelled', 'rejected')),
    'avg_prep_minutes', (select coalesce(round(avg(extract(epoch from (ready_at - started_at)) / 60)::numeric, 1), 0)
                         from ord where ready_at is not null and started_at is not null),
    'by_channel', (select coalesce(jsonb_object_agg(channel, total), '{}'::jsonb) from (
        select t.channel, sum(p.amount_cents) as total from pay p join public.tabs t on t.id = p.tab_id
        where p.status = 'confirmed' group by t.channel) s),
    'by_method', (select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'kind', m.kind, 'total_cents', s.total) order by s.total desc), '[]'::jsonb)
        from (select method_id, sum(amount_cents) as total from pay where status = 'confirmed' group by method_id) s
        join public.payment_methods m on m.id = s.method_id),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'total_cents', coalesce(s.total, 0)) order by d), '[]'::jsonb)
        from generate_series(p_from, p_to, interval '1 day') d
        left join (select business_day, sum(amount_cents) as total from pay where status = 'confirmed' group by business_day) s
          on s.business_day = d::date),
    'top_products', (select coalesce(jsonb_agg(x order by (x ->> 'quantity')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('name', i.name, 'quantity', sum(i.quantity), 'total_cents', sum(i.quantity * i.unit_price_cents)) as x
        from public.order_items i join ord o on o.id = i.order_id
        where i.status = 'active' and o.status not in ('cancelled', 'rejected', 'pending_confirmation')
        group by i.name order by sum(i.quantity) desc limit 10) s),
    -- Pendências reais da operação, independentemente do dia de abertura
    'pending', jsonb_build_object(
      'open_tabs', (select count(*) from public.tabs where tenant_id = p_tenant and status = 'open'),
      'open_tabs_previous_days', (select count(*) from public.tabs where tenant_id = p_tenant and status = 'open'
                                   and business_day < private.business_day(p_tenant)),
      'receivable_open_cents', (select coalesce(sum(total_cents - paid_cents), 0) from public.tabs where tenant_id = p_tenant and status = 'open'),
      'orders_in_production', (select count(*) from public.orders where tenant_id = p_tenant and status in ('confirmed', 'preparing')),
      'orders_ready', (select count(*) from public.orders where tenant_id = p_tenant and status = 'ready'),
      'orders_awaiting_confirmation', (select count(*) from public.orders where tenant_id = p_tenant and status = 'pending_confirmation'),
      'approvals', (select count(*) from public.approval_requests where tenant_id = p_tenant and status = 'pending' and expires_at > now()),
      'open_cash_sessions', (select count(*) from public.cash_sessions where tenant_id = p_tenant and status = 'open'),
      'cash_divergence_cents', (select coalesce(sum(divergence_cents), 0) from public.cash_sessions
                                 where tenant_id = p_tenant and business_day between p_from and p_to),
      'low_stock', (select count(*) from jsonb_array_elements(public.stock_overview(p_tenant)) e where (e ->> 'below_min')::boolean),
      'payables_due_cents', (select coalesce(sum(amount_cents), 0) from public.payables where tenant_id = p_tenant
                              and status = 'open' and due_date <= current_date + 7)
    ),
    'today', private.business_day(p_tenant)
  ) into v_result;
  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- Primeiro acesso: progresso calculado a partir dos dados reais + marcações
-- ---------------------------------------------------------------------------
create or replace function public.onboarding_state(p_tenant uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_t public.tenants;
  v_modules text[];
begin
  if not private.is_member(p_tenant) then
    perform private.fail('FORBIDDEN', 'Acesso negado.');
  end if;
  select * into v_t from public.tenants where id = p_tenant;
  select array_agg(module::text) into v_modules from public.tenant_modules where tenant_id = p_tenant;
  return jsonb_build_object(
    'completed_at', v_t.onboarding_completed_at,
    'modules', coalesce(to_jsonb(v_modules), '[]'::jsonb),
    'manual', coalesce((select jsonb_object_agg(step, status) from public.onboarding_steps where tenant_id = p_tenant), '{}'::jsonb),
    'detected', jsonb_build_object(
      'restaurante', v_t.phone is not null or v_t.address <> '{}'::jsonb or v_t.logo_path is not null,
      'equipe', exists (select 1 from public.memberships where tenant_id = p_tenant and not is_owner),
      'permissoes', exists (select 1 from public.membership_roles where tenant_id = p_tenant),
      'mesas', exists (select 1 from public.dining_tables where tenant_id = p_tenant),
      'horarios', exists (select 1 from public.business_hours where tenant_id = p_tenant),
      'cardapio', exists (select 1 from public.products where tenant_id = p_tenant and active),
      'pagamentos', exists (select 1 from public.payment_methods where tenant_id = p_tenant and active),
      'cardapio_local', v_t.settings ? 'local_order_mode',
      'delivery', exists (select 1 from public.delivery_zones where tenant_id = p_tenant) and coalesce((v_t.settings ->> 'delivery_enabled')::boolean, false),
      'financeiro', exists (select 1 from public.suppliers where tenant_id = p_tenant),
      'estoque', exists (select 1 from public.stock_locations where tenant_id = p_tenant)
        or not private.process_internal(p_tenant, 'estoque')
    )
  );
end $$;

create or replace function public.onboarding_mark(p_tenant uuid, p_step text, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner(p_tenant)
     and private.evaluate_permission((select auth.uid()), p_tenant, 'gestao.restaurante.alterar') <> 'direct' then
    perform private.fail('FORBIDDEN', 'Somente o titular ou gestor autorizado conduz o primeiro acesso.');
  end if;
  if p_status not in ('pending', 'done', 'skipped') then perform private.fail('INVALID', 'Situação inválida.'); end if;
  insert into public.onboarding_steps (tenant_id, step, status, updated_by)
    values (p_tenant, p_step, p_status, (select auth.uid()))
    on conflict (tenant_id, step) do update set status = excluded.status, updated_by = excluded.updated_by, updated_at = now();
end $$;

create or replace function public.onboarding_finish(p_tenant uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner(p_tenant)
     and private.evaluate_permission((select auth.uid()), p_tenant, 'gestao.restaurante.alterar') <> 'direct' then
    perform private.fail('FORBIDDEN', 'Somente o titular ou gestor autorizado conclui o primeiro acesso.');
  end if;
  update public.tenants set onboarding_completed_at = coalesce(onboarding_completed_at, now()) where id = p_tenant;
  perform private.audit(p_tenant, 'gestao', 'onboarding.finished', 'tenant', p_tenant::text);
end $$;
