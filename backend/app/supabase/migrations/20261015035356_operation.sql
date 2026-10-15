-- Operação: comandas, pedidos, cozinha, caixa e delivery (lado interno).
-- Estados e transições são validados aqui; a interface apenas envia comandos.

create type public.order_status as enum (
  'pending_confirmation', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled', 'rejected'
);
create type public.tab_status as enum ('open', 'closed', 'cancelled');
create type public.delivery_status as enum (
  'awaiting_acceptance', 'accepted', 'rejected', 'out_for_delivery', 'delivered', 'cancelled'
);

create table private.counters (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  value bigint not null default 0,
  primary key (tenant_id, name)
);

create or replace function private.next_number(p_tenant uuid, p_name text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v bigint;
begin
  insert into private.counters (tenant_id, name, value) values (p_tenant, p_name, 1)
  on conflict (tenant_id, name) do update set value = private.counters.value + 1
  returning value into v;
  return v;
end $$;

-- Dia operacional do restaurante (ex.: das 04:00 às 03:59 do dia seguinte)
create or replace function private.business_day(p_tenant uuid, p_at timestamptz default now())
returns date language sql stable security definer set search_path = '' as $$
  select ((p_at at time zone t.timezone) - make_interval(hours => t.business_day_start_hour))::date
  from public.tenants t where t.id = p_tenant
$$;

create table public.tabs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  number bigint not null,
  table_id uuid references public.dining_tables (id) on delete set null,
  channel text not null default 'salao' check (channel in ('salao', 'balcao', 'delivery')),
  status public.tab_status not null default 'open',
  customer_name text,
  guest_count smallint check (guest_count between 1 and 99),
  service_fee_percent numeric(5, 2) not null default 0,
  subtotal_cents bigint not null default 0,
  service_fee_cents bigint not null default 0,
  delivery_fee_cents bigint not null default 0,
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  total_cents bigint not null default 0,
  paid_cents bigint not null default 0,
  bill_requested_at timestamptz,
  bill_requested_by text check (bill_requested_by in ('cliente', 'atendimento')),
  forwarded_to_cashier_at timestamptz,
  business_day date not null,
  opened_by uuid references auth.users (id),
  opened_at timestamptz not null default now(),
  closed_by uuid references auth.users (id),
  closed_at timestamptz,
  idempotency_key text,
  notes text,
  unique (tenant_id, number),
  unique (tenant_id, idempotency_key)
);
create unique index tabs_one_open_per_table on public.tabs (table_id) where status = 'open' and table_id is not null;
create index tabs_tenant_status_idx on public.tabs (tenant_id, status, opened_at desc);
create index tabs_tenant_day_idx on public.tabs (tenant_id, business_day);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tab_id uuid not null references public.tabs (id) on delete cascade,
  number bigint not null,
  source text not null check (source in ('atendimento', 'cardapio', 'delivery', 'balcao')),
  status public.order_status not null default 'confirmed',
  stage text,
  delivery_by text not null default 'atendimento' check (delivery_by in ('atendimento', 'cozinha', 'entregador')),
  has_issue boolean not null default false,
  notes text,
  guest_key text,
  created_by uuid references auth.users (id),
  idempotency_key text,
  business_day date not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  started_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  delivered_by uuid references auth.users (id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id),
  cancel_reason text,
  unique (tenant_id, number),
  unique (tenant_id, idempotency_key)
);
create index orders_tab_idx on public.orders (tab_id);
create index orders_tenant_status_idx on public.orders (tenant_id, status, created_at);
create index orders_tenant_day_idx on public.orders (tenant_id, business_day);
create index orders_guest_idx on public.orders (guest_key) where guest_key is not null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  quantity int not null check (quantity between 1 and 99),
  notes text,
  status text not null default 'active' check (status in ('active', 'cancelled', 'unavailable')),
  status_reason text,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);
create index order_items_tenant_idx on public.order_items (tenant_id);

create table public.delivery_orders (
  tab_id uuid primary key references public.tabs (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_name text not null,
  whatsapp text not null,
  address jsonb not null,
  zone_id uuid references public.delivery_zones (id) on delete set null,
  fee_cents bigint not null default 0,
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  change_for_cents bigint,
  status public.delivery_status not null default 'awaiting_acceptance',
  tracking_token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  notes text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id),
  rejected_reason text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  delivered_by uuid references auth.users (id)
);
create index delivery_orders_tenant_status_idx on public.delivery_orders (tenant_id, status, created_at desc);
create index delivery_orders_zone_idx on public.delivery_orders (zone_id);
create index delivery_orders_method_idx on public.delivery_orders (payment_method_id);

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  operator_id uuid not null references auth.users (id),
  status text not null default 'open' check (status in ('open', 'closed')),
  opening_cents bigint not null check (opening_cents >= 0),
  opened_at timestamptz not null default now(),
  business_day date not null,
  closed_at timestamptz,
  closed_by uuid references auth.users (id),
  expected jsonb,
  counted jsonb,
  divergence_cents bigint,
  notes text,
  idempotency_key text,
  unique (tenant_id, idempotency_key)
);
create unique index cash_sessions_one_open_per_operator on public.cash_sessions (tenant_id, operator_id) where status = 'open';
create index cash_sessions_tenant_idx on public.cash_sessions (tenant_id, opened_at desc);
create index cash_sessions_operator_idx on public.cash_sessions (operator_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tab_id uuid not null references public.tabs (id),
  cash_session_id uuid references public.cash_sessions (id),
  method_id uuid not null references public.payment_methods (id),
  method_kind text not null,
  amount_cents bigint not null check (amount_cents > 0),
  tendered_cents bigint not null,
  change_cents bigint not null default 0 check (change_cents >= 0),
  payer_label text,
  context text not null check (context in ('caixa', 'atendimento', 'delivery')),
  status text not null default 'confirmed' check (status in ('confirmed', 'refunded')),
  received_by uuid not null references auth.users (id),
  received_at timestamptz not null default now(),
  business_day date not null,
  refunded_at timestamptz,
  refunded_by uuid references auth.users (id),
  refund_session_id uuid references public.cash_sessions (id),
  refund_reason text,
  receipt_number bigint not null,
  idempotency_key text not null,
  unique (tenant_id, idempotency_key),
  unique (tenant_id, receipt_number)
);
create index payments_tab_idx on public.payments (tab_id);
create index payments_session_idx on public.payments (cash_session_id);
create index payments_refund_session_idx on public.payments (refund_session_id);
create index payments_method_idx on public.payments (method_id);
create index payments_tenant_day_idx on public.payments (tenant_id, business_day);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  cash_session_id uuid not null references public.cash_sessions (id),
  kind text not null check (kind in ('sangria', 'suprimento')),
  amount_cents bigint not null check (amount_cents > 0),
  reason text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  idempotency_key text not null,
  unique (tenant_id, idempotency_key)
);
create index cash_movements_session_idx on public.cash_movements (cash_session_id);

alter table public.tabs enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.delivery_orders enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.payments enable row level security;
alter table public.cash_movements enable row level security;
alter table private.counters enable row level security;

create policy tabs_select on public.tabs for select to authenticated using ((select private.is_member(tenant_id)));
create policy orders_select on public.orders for select to authenticated using ((select private.is_member(tenant_id)));
create policy order_items_select on public.order_items for select to authenticated using ((select private.is_member(tenant_id)));
create policy delivery_orders_select on public.delivery_orders for select to authenticated using ((select private.is_member(tenant_id)));
create policy cash_sessions_select on public.cash_sessions for select to authenticated using (
  operator_id = (select auth.uid()) or (select private.is_owner(tenant_id))
  or private.evaluate_permission((select auth.uid()), tenant_id, 'caixa.historico.visualizar') = 'direct'
  or private.evaluate_permission((select auth.uid()), tenant_id, 'gestao.indicadores.visualizar') = 'direct');
create policy payments_select on public.payments for select to authenticated using ((select private.is_member(tenant_id)));
create policy cash_movements_select on public.cash_movements for select to authenticated using (
  (select private.is_owner(tenant_id))
  or exists (select 1 from public.cash_sessions s where s.id = cash_session_id and s.operator_id = (select auth.uid()))
  or private.evaluate_permission((select auth.uid()), tenant_id, 'caixa.historico.visualizar') = 'direct');

-- ---------------------------------------------------------------------------
-- Cálculo da comanda e encerramento automático
-- ---------------------------------------------------------------------------
create or replace function private.recalc_tab(p_tab uuid)
returns public.tabs language plpgsql security definer set search_path = '' as $$
declare
  v_tab public.tabs;
  v_subtotal bigint;
  v_paid bigint;
  v_fee bigint;
begin
  select coalesce(sum(i.unit_price_cents * i.quantity), 0) into v_subtotal
  from public.order_items i join public.orders o on o.id = i.order_id
  where o.tab_id = p_tab and i.status = 'active'
    and o.status in ('confirmed', 'preparing', 'ready', 'delivered');
  select coalesce(sum(amount_cents), 0) into v_paid
  from public.payments where tab_id = p_tab and status = 'confirmed';

  select * into v_tab from public.tabs where id = p_tab;
  v_fee := round(v_subtotal * v_tab.service_fee_percent / 100.0);
  update public.tabs set
    subtotal_cents = v_subtotal,
    service_fee_cents = v_fee,
    discount_cents = least(discount_cents, v_subtotal + v_fee + delivery_fee_cents),
    total_cents = greatest(v_subtotal + v_fee + delivery_fee_cents - least(discount_cents, v_subtotal + v_fee + delivery_fee_cents), 0),
    paid_cents = v_paid
  where id = p_tab
  returning * into v_tab;
  return v_tab;
end $$;

-- Pendências operacionais que impedem encerrar a comanda e liberar a mesa
create or replace function private.tab_has_pending_orders(p_tab uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.orders o where o.tab_id = p_tab
      and o.status in ('pending_confirmation', 'confirmed', 'preparing', 'ready')
  ) or exists (
    select 1 from public.delivery_orders d where d.tab_id = p_tab
      and d.status in ('awaiting_acceptance', 'accepted', 'out_for_delivery')
  )
$$;

-- Comanda quitada e sem pendências é encerrada; a mesa fica livre.
create or replace function private.try_autoclose(p_tab uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_tab public.tabs;
begin
  select * into v_tab from public.tabs where id = p_tab;
  if v_tab.status = 'open' and v_tab.total_cents > 0 and v_tab.paid_cents >= v_tab.total_cents
     and not private.tab_has_pending_orders(p_tab) then
    update public.tabs set status = 'closed', closed_at = now(), closed_by = (select auth.uid()) where id = p_tab;
    perform private.audit(v_tab.tenant_id, 'atendimento', 'tab.auto_closed', 'tab', p_tab::text,
      jsonb_build_object('number', v_tab.number, 'total_cents', v_tab.total_cents));
    return true;
  end if;
  return false;
end $$;

create or replace function private.lock_tab(p_tenant uuid, p_tab uuid)
returns public.tabs language plpgsql security definer set search_path = '' as $$
declare v_tab public.tabs;
begin
  select * into v_tab from public.tabs where id = p_tab and tenant_id = p_tenant for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Comanda não encontrada.');
  end if;
  return v_tab;
end $$;

create or replace function private.tab_json(p_tab uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(t) || jsonb_build_object('balance_cents', t.total_cents - t.paid_cents,
    'has_pending_orders', private.tab_has_pending_orders(t.id))
  from public.tabs t where t.id = p_tab
$$;

-- Inserção dos itens de um pedido com preço vigente (snapshot).
create or replace function private.insert_order_items(
  p_tenant uuid, p_order uuid, p_items jsonb, p_channel text
) returns int language plpgsql security definer set search_path = '' as $$
declare
  v_item jsonb;
  v_product public.products;
  v_count int := 0;
  v_qty int;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform private.fail('EMPTY_ORDER', 'Adicione ao menos um item ao pedido.');
  end if;
  if jsonb_array_length(p_items) > 60 then
    perform private.fail('INVALID', 'Pedido com itens demais.');
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and tenant_id = p_tenant;
    if not found or not v_product.active then
      perform private.fail('PRODUCT_UNAVAILABLE', 'Produto indisponível.');
    end if;
    if not v_product.available then
      perform private.fail('PRODUCT_UNAVAILABLE', '"' || v_product.name || '" está indisponível no momento.');
    end if;
    if not (p_channel = any (v_product.channels)) then
      perform private.fail('PRODUCT_UNAVAILABLE', '"' || v_product.name || '" não está disponível neste canal.');
    end if;
    v_qty := coalesce((v_item ->> 'quantity')::int, 0);
    if v_qty < 1 or v_qty > 99 then
      perform private.fail('INVALID', 'Quantidade inválida para "' || v_product.name || '".');
    end if;
    insert into public.order_items (tenant_id, order_id, product_id, name, unit_price_cents, quantity, notes)
      values (p_tenant, p_order, v_product.id, v_product.name, v_product.price_cents, v_qty,
        nullif(left(trim(coalesce(v_item ->> 'notes', '')), 200), ''));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Atendimento
-- ---------------------------------------------------------------------------
-- Abre (ou localiza) a comanda da mesa.
create or replace function public.tab_open(
  p_tenant uuid, p_table uuid, p_customer_name text, p_guest_count smallint, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tab public.tabs;
  v_table public.dining_tables;
  v_fee numeric;
begin
  perform private.authorize(p_tenant, 'atendimento.comanda.abrir');
  if p_idempotency_key is not null then
    select * into v_tab from public.tabs where tenant_id = p_tenant and idempotency_key = p_idempotency_key;
    if found then return private.tab_json(v_tab.id); end if;
  end if;

  if p_table is not null then
    select * into v_table from public.dining_tables where id = p_table and tenant_id = p_tenant for update;
    if not found or not v_table.active then
      perform private.fail('NOT_FOUND', 'Mesa não encontrada.');
    end if;
    select * into v_tab from public.tabs where table_id = p_table and status = 'open';
    if found then return private.tab_json(v_tab.id); end if;
  end if;

  select coalesce((settings ->> 'service_fee_percent')::numeric, 0) into v_fee from public.tenants where id = p_tenant;
  insert into public.tabs (tenant_id, number, table_id, channel, customer_name, guest_count, service_fee_percent,
    business_day, opened_by, idempotency_key)
  values (p_tenant, private.next_number(p_tenant, 'tab'), p_table, case when p_table is null then 'balcao' else 'salao' end,
    nullif(trim(coalesce(p_customer_name, '')), ''), p_guest_count, case when p_table is null then 0 else v_fee end,
    private.business_day(p_tenant), (select auth.uid()), p_idempotency_key)
  returning * into v_tab;
  perform private.audit(p_tenant, 'atendimento', 'tab.opened', 'tab', v_tab.id::text,
    jsonb_build_object('number', v_tab.number, 'table', v_table.label));
  return private.tab_json(v_tab.id);
end $$;

-- Registra e envia um pedido para a produção.
create or replace function public.order_create(
  p_tenant uuid, p_tab uuid, p_items jsonb, p_notes text, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tab public.tabs;
  v_order public.orders;
  v_kitchen_delivers boolean;
begin
  perform private.authorize(p_tenant, 'atendimento.pedido.registrar');
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    perform private.fail('INVALID', 'Chave de idempotência obrigatória.');
  end if;
  select * into v_order from public.orders where tenant_id = p_tenant and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order', to_jsonb(v_order), 'tab', private.tab_json(v_order.tab_id), 'duplicate', true);
  end if;
  v_tab := private.lock_tab(p_tenant, p_tab);
  if v_tab.status <> 'open' then
    perform private.fail('TAB_CLOSED', 'A comanda não está aberta.');
  end if;
  if v_tab.channel = 'delivery' then
    perform private.fail('INVALID', 'Pedidos de delivery são registrados pelo cliente no link de delivery.');
  end if;
  select coalesce((settings ->> 'kitchen_delivers')::boolean, false) into v_kitchen_delivers from public.tenants where id = p_tenant;
  insert into public.orders (tenant_id, tab_id, number, source, status, notes, created_by, idempotency_key,
    business_day, confirmed_at, delivery_by)
  values (p_tenant, p_tab, private.next_number(p_tenant, 'order'),
    case when v_tab.channel = 'balcao' then 'balcao' else 'atendimento' end, 'confirmed',
    nullif(left(trim(coalesce(p_notes, '')), 300), ''), (select auth.uid()), p_idempotency_key,
    private.business_day(p_tenant), now(), case when v_kitchen_delivers then 'cozinha' else 'atendimento' end)
  returning * into v_order;
  perform private.insert_order_items(p_tenant, v_order.id, p_items, 'salao');
  perform private.recalc_tab(p_tab);
  perform private.audit(p_tenant, 'atendimento', 'order.created', 'order', v_order.id::text,
    jsonb_build_object('number', v_order.number, 'tab', v_tab.number, 'items', p_items));
  return jsonb_build_object('order', to_jsonb(v_order), 'tab', private.tab_json(p_tab), 'duplicate', false);
end $$;

-- Confirma (ou recusa) pedido feito pelo cliente no QR Code.
create or replace function public.order_review_customer(p_tenant uuid, p_order uuid, p_accept boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders;
begin
  perform private.authorize(p_tenant, 'atendimento.pedido.confirmar_cliente');
  select * into v_order from public.orders where id = p_order and tenant_id = p_tenant for update;
  if not found then perform private.fail('NOT_FOUND', 'Pedido não encontrado.'); end if;
  if v_order.status <> 'pending_confirmation' or v_order.source <> 'cardapio' then
    perform private.fail('INVALID_STATE', 'Este pedido não aguarda confirmação.');
  end if;
  perform private.lock_tab(p_tenant, v_order.tab_id);
  if p_accept then
    update public.orders set status = 'confirmed', confirmed_at = now() where id = p_order;
  else
    update public.orders set status = 'rejected', cancelled_at = now(), cancelled_by = (select auth.uid()),
      cancel_reason = coalesce(nullif(trim(p_reason), ''), 'Recusado pelo atendimento') where id = p_order;
  end if;
  perform private.recalc_tab(v_order.tab_id);
  perform private.audit(p_tenant, 'atendimento', case when p_accept then 'order.customer_confirmed' else 'order.customer_rejected' end,
    'order', p_order::text, jsonb_build_object('number', v_order.number, 'reason', p_reason));
  return private.tab_json(v_order.tab_id);
end $$;

-- Cancelamento de pedido inteiro (Atendimento ou Cozinha, conforme permissão).
create or replace function public.order_cancel(p_tenant uuid, p_order uuid, p_reason text, p_context text default 'atendimento')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_tab public.tabs;
  v_value bigint;
  v_approval uuid;
begin
  select * into v_order from public.orders where id = p_order and tenant_id = p_tenant;
  if not found then perform private.fail('NOT_FOUND', 'Pedido não encontrado.'); end if;
  select coalesce(sum(unit_price_cents * quantity), 0) into v_value from public.order_items where order_id = p_order and status = 'active';
  v_approval := private.authorize(p_tenant,
    case when p_context = 'cozinha' then 'cozinha.pedido.cancelar' else 'atendimento.pedido.cancelar' end, v_value);
  if coalesce(trim(p_reason), '') = '' then
    perform private.fail('INVALID', 'Informe o motivo do cancelamento.');
  end if;
  v_tab := private.lock_tab(p_tenant, v_order.tab_id);
  select * into v_order from public.orders where id = p_order for update;
  if v_order.status not in ('pending_confirmation', 'confirmed', 'preparing') then
    perform private.fail('INVALID_STATE', 'Pedidos prontos ou entregues não podem ser cancelados.');
  end if;
  update public.orders set status = 'cancelled', cancelled_at = now(), cancelled_by = (select auth.uid()), cancel_reason = trim(p_reason)
    where id = p_order;
  v_tab := private.recalc_tab(v_order.tab_id);
  if v_tab.paid_cents > v_tab.total_cents then
    perform private.fail('REFUND_REQUIRED', 'O valor já recebido supera o novo total. Estorne o pagamento no Caixa antes de cancelar.');
  end if;
  perform private.audit(p_tenant, case when p_context = 'cozinha' then 'cozinha' else 'atendimento' end::public.app_module,
    'order.cancelled', 'order', p_order::text, jsonb_build_object('number', v_order.number, 'reason', p_reason, 'value_cents', v_value), v_approval);
  perform private.try_autoclose(v_order.tab_id);
  return private.tab_json(v_order.tab_id);
end $$;

-- Cancelamento ou correção de um item.
create or replace function public.order_item_cancel(p_tenant uuid, p_item uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_item public.order_items;
  v_order public.orders;
  v_tab public.tabs;
  v_approval uuid;
begin
  select * into v_item from public.order_items where id = p_item and tenant_id = p_tenant;
  if not found then perform private.fail('NOT_FOUND', 'Item não encontrado.'); end if;
  v_approval := private.authorize(p_tenant, 'atendimento.pedido.cancelar', v_item.unit_price_cents * v_item.quantity);
  if coalesce(trim(p_reason), '') = '' then
    perform private.fail('INVALID', 'Informe o motivo.');
  end if;
  select * into v_order from public.orders where id = v_item.order_id;
  v_tab := private.lock_tab(p_tenant, v_order.tab_id);
  select * into v_item from public.order_items where id = p_item for update;
  if v_item.status = 'cancelled' then
    return private.tab_json(v_order.tab_id);
  end if;
  if v_order.status in ('delivered', 'cancelled', 'rejected') then
    perform private.fail('INVALID_STATE', 'Itens de pedidos entregues ou cancelados não podem ser alterados.');
  end if;
  update public.order_items set status = 'cancelled', status_reason = trim(p_reason) where id = p_item;
  if not exists (select 1 from public.order_items where order_id = v_order.id and status = 'active') then
    update public.orders set status = 'cancelled', cancelled_at = now(), cancelled_by = (select auth.uid()),
      cancel_reason = 'Todos os itens cancelados', has_issue = false where id = v_order.id;
  elsif not exists (select 1 from public.order_items where order_id = v_order.id and status = 'unavailable') then
    update public.orders set has_issue = false where id = v_order.id;
  end if;
  v_tab := private.recalc_tab(v_order.tab_id);
  if v_tab.paid_cents > v_tab.total_cents then
    perform private.fail('REFUND_REQUIRED', 'O valor já recebido supera o novo total. Estorne o pagamento no Caixa antes.');
  end if;
  perform private.audit(p_tenant, 'atendimento', 'order_item.cancelled', 'order_item', p_item::text,
    jsonb_build_object('order', v_order.number, 'name', v_item.name, 'reason', p_reason), v_approval);
  perform private.try_autoclose(v_order.tab_id);
  return private.tab_json(v_order.tab_id);
end $$;

-- Atendimento resolveu a indisponibilidade com o cliente.
create or replace function public.order_resolve_issue(p_tenant uuid, p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.authorize(p_tenant, 'atendimento.pedido.registrar');
  update public.orders set has_issue = false where id = p_order and tenant_id = p_tenant;
  perform private.audit(p_tenant, 'atendimento', 'order.issue_resolved', 'order', p_order::text);
end $$;

-- Confirma a entrega (Atendimento retira e entrega, ou Cozinha entrega).
create or replace function public.order_deliver(p_tenant uuid, p_order uuid, p_context text default 'atendimento')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders;
begin
  perform private.authorize(p_tenant,
    case when p_context = 'cozinha' then 'cozinha.entrega.confirmar' else 'atendimento.entrega.confirmar' end);
  select * into v_order from public.orders where id = p_order and tenant_id = p_tenant;
  if not found then perform private.fail('NOT_FOUND', 'Pedido não encontrado.'); end if;
  perform private.lock_tab(p_tenant, v_order.tab_id);
  select * into v_order from public.orders where id = p_order for update;
  if v_order.status = 'delivered' then
    return private.tab_json(v_order.tab_id);
  end if;
  if v_order.status <> 'ready' then
    perform private.fail('INVALID_STATE', 'Somente pedidos prontos podem ser entregues.');
  end if;
  if v_order.source = 'delivery' then
    perform private.fail('INVALID_STATE', 'Pedidos de delivery são concluídos na entrega ao cliente.');
  end if;
  update public.orders set status = 'delivered', delivered_at = now(), delivered_by = (select auth.uid()) where id = p_order;
  perform private.audit(p_tenant, case when p_context = 'cozinha' then 'cozinha' else 'atendimento' end::public.app_module,
    'order.delivered', 'order', p_order::text, jsonb_build_object('number', v_order.number));
  perform private.recalc_tab(v_order.tab_id);
  perform private.try_autoclose(v_order.tab_id);
  return private.tab_json(v_order.tab_id);
end $$;

create or replace function public.tab_transfer(p_tenant uuid, p_tab uuid, p_to_table uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tab public.tabs;
  v_to public.dining_tables;
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'atendimento.mesa.transferir');
  v_tab := private.lock_tab(p_tenant, p_tab);
  if v_tab.status <> 'open' or v_tab.channel <> 'salao' then
    perform private.fail('INVALID_STATE', 'Somente comandas abertas do salão podem ser transferidas.');
  end if;
  select * into v_to from public.dining_tables where id = p_to_table and tenant_id = p_tenant and active for update;
  if not found then perform private.fail('NOT_FOUND', 'Mesa de destino não encontrada.'); end if;
  if exists (select 1 from public.tabs where table_id = p_to_table and status = 'open') then
    perform private.fail('TABLE_OCCUPIED', 'A mesa de destino está ocupada.');
  end if;
  update public.tabs set table_id = p_to_table where id = p_tab;
  perform private.audit(p_tenant, 'atendimento', 'tab.transferred', 'tab', p_tab::text,
    jsonb_build_object('from', v_tab.table_id, 'to', p_to_table, 'number', v_tab.number), v_approval);
  return private.tab_json(p_tab);
end $$;

-- Solicita fechamento (atendente) e, opcionalmente, encaminha ao Caixa.
create or replace function public.tab_request_bill(p_tenant uuid, p_tab uuid, p_forward_to_cashier boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tab public.tabs;
begin
  perform private.authorize(p_tenant, 'atendimento.pedido.registrar');
  v_tab := private.lock_tab(p_tenant, p_tab);
  if v_tab.status <> 'open' then perform private.fail('TAB_CLOSED', 'A comanda não está aberta.'); end if;
  update public.tabs set bill_requested_at = coalesce(bill_requested_at, now()),
    bill_requested_by = coalesce(bill_requested_by, 'atendimento'),
    forwarded_to_cashier_at = case when p_forward_to_cashier then now() else forwarded_to_cashier_at end
    where id = p_tab;
  perform private.audit(p_tenant, 'atendimento',
    case when p_forward_to_cashier then 'tab.forwarded_to_cashier' else 'tab.bill_requested' end,
    'tab', p_tab::text, jsonb_build_object('number', v_tab.number));
  return private.tab_json(p_tab);
end $$;

-- Encerra a comanda manualmente (sem consumo ou quitada sem pendências).
create or replace function public.tab_close(p_tenant uuid, p_tab uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tab public.tabs;
begin
  perform private.authorize(p_tenant, 'atendimento.comanda.encerrar');
  v_tab := private.lock_tab(p_tenant, p_tab);
  if v_tab.status <> 'open' then
    return private.tab_json(p_tab);
  end if;
  v_tab := private.recalc_tab(p_tab);
  if private.tab_has_pending_orders(p_tab) then
    perform private.fail('PENDING_ORDERS', 'Há pedidos ainda não entregues nesta comanda.');
  end if;
  if v_tab.paid_cents < v_tab.total_cents then
    perform private.fail('BALANCE_DUE', 'A comanda possui saldo a receber.');
  end if;
  update public.tabs set status = case when v_tab.total_cents = 0 and v_tab.paid_cents = 0 then 'cancelled' else 'closed' end::public.tab_status,
    closed_at = now(), closed_by = (select auth.uid())
    where id = p_tab;
  perform private.audit(p_tenant, 'atendimento', 'tab.closed', 'tab', p_tab::text,
    jsonb_build_object('number', v_tab.number, 'total_cents', v_tab.total_cents));
  return private.tab_json(p_tab);
end $$;

create or replace function public.table_delete(p_tenant uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'cadastros.mesas.excluir');
  if exists (select 1 from public.tabs where table_id = p_id and status = 'open') then
    perform private.fail('TABLE_OCCUPIED', 'A mesa possui comanda aberta.');
  end if;
  if exists (select 1 from public.tabs where table_id = p_id) then
    update public.dining_tables set active = false where id = p_id and tenant_id = p_tenant;
  else
    delete from public.dining_tables where id = p_id and tenant_id = p_tenant;
  end if;
  perform private.audit(p_tenant, 'gestao', 'table.deleted', 'dining_table', p_id::text, '{}'::jsonb, v_approval);
end $$;

-- ---------------------------------------------------------------------------
-- Cozinha
-- ---------------------------------------------------------------------------
create or replace function public.kitchen_advance(p_tenant uuid, p_order uuid, p_to public.order_status, p_stage text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders;
begin
  perform private.authorize(p_tenant, 'cozinha.preparo.executar');
  select * into v_order from public.orders where id = p_order and tenant_id = p_tenant;
  if not found then perform private.fail('NOT_FOUND', 'Pedido não encontrado.'); end if;
  perform private.lock_tab(p_tenant, v_order.tab_id);
  select * into v_order from public.orders where id = p_order for update;
  if p_to = 'preparing' and v_order.status = 'confirmed' then
    update public.orders set status = 'preparing', started_at = now(), stage = p_stage where id = p_order;
  elsif p_to = 'preparing' and v_order.status = 'preparing' then
    update public.orders set stage = p_stage where id = p_order;
  elsif p_to = 'ready' and v_order.status = 'preparing' then
    if v_order.has_issue then
      perform private.fail('ORDER_HAS_ISSUE', 'Resolva a indisponibilidade com o Atendimento antes de concluir.');
    end if;
    update public.orders set status = 'ready', ready_at = now(), stage = null where id = p_order;
  elsif v_order.status = p_to then
    return to_jsonb(v_order);
  else
    perform private.fail('INVALID_STATE', 'Transição de preparo inválida.');
  end if;
  perform private.audit(p_tenant, 'cozinha', 'order.' || p_to::text, 'order', p_order::text,
    jsonb_build_object('number', v_order.number, 'stage', p_stage));
  select * into v_order from public.orders where id = p_order;
  return to_jsonb(v_order);
end $$;

create or replace function public.kitchen_item_unavailable(p_tenant uuid, p_item uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_item public.order_items;
  v_order public.orders;
begin
  perform private.authorize(p_tenant, 'cozinha.item.indisponivel');
  select * into v_item from public.order_items where id = p_item and tenant_id = p_tenant;
  if not found then perform private.fail('NOT_FOUND', 'Item não encontrado.'); end if;
  select * into v_order from public.orders where id = v_item.order_id;
  perform private.lock_tab(p_tenant, v_order.tab_id);
  if v_order.status not in ('confirmed', 'preparing') or v_item.status <> 'active' then
    perform private.fail('INVALID_STATE', 'O item não pode ser sinalizado.');
  end if;
  update public.order_items set status = 'unavailable', status_reason = nullif(trim(coalesce(p_note, '')), '') where id = p_item;
  update public.orders set has_issue = true where id = v_order.id;
  if v_item.product_id is not null then
    update public.products set available = false where id = v_item.product_id;
  end if;
  perform private.recalc_tab(v_order.tab_id);
  perform private.audit(p_tenant, 'cozinha', 'order_item.unavailable', 'order_item', p_item::text,
    jsonb_build_object('order', v_order.number, 'name', v_item.name, 'note', p_note));
end $$;

-- Disponibilidade de produto pela produção (ex.: voltou a ter o ingrediente)
create or replace function public.product_set_available(p_tenant uuid, p_product uuid, p_available boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.evaluate_permission((select auth.uid()), p_tenant, 'cozinha.item.indisponivel') = 'direct' then
    perform private.authorize(p_tenant, 'cozinha.item.indisponivel');
  else
    perform private.authorize(p_tenant, 'cadastros.produtos.alterar');
  end if;
  update public.products set available = p_available where id = p_product and tenant_id = p_tenant;
  perform private.audit(p_tenant, 'cozinha', 'product.availability', 'product', p_product::text, jsonb_build_object('available', p_available));
end $$;

-- ---------------------------------------------------------------------------
-- Caixa
-- ---------------------------------------------------------------------------
create or replace function public.cash_session_open(p_tenant uuid, p_opening_cents bigint, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.authorize(p_tenant, 'caixa.abrir');
  if p_opening_cents is null or p_opening_cents < 0 then
    perform private.fail('INVALID', 'Informe o valor inicial.');
  end if;
  select id into v_id from public.cash_sessions where tenant_id = p_tenant and idempotency_key = p_idempotency_key;
  if found then return v_id; end if;
  select id into v_id from public.cash_sessions where tenant_id = p_tenant and operator_id = (select auth.uid()) and status = 'open';
  if found then
    perform private.fail('CASH_ALREADY_OPEN', 'Você já possui um caixa aberto.');
  end if;
  insert into public.cash_sessions (tenant_id, operator_id, opening_cents, business_day, idempotency_key)
    values (p_tenant, (select auth.uid()), p_opening_cents, private.business_day(p_tenant), p_idempotency_key)
    returning id into v_id;
  perform private.audit(p_tenant, 'caixa', 'cash.opened', 'cash_session', v_id::text, jsonb_build_object('opening_cents', p_opening_cents));
  return v_id;
end $$;

create or replace function private.open_session_of_current_user(p_tenant uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.cash_sessions where tenant_id = p_tenant and operator_id = (select auth.uid()) and status = 'open'
$$;

-- Recebimento (Caixa, Atendimento autorizado ou responsável pelo delivery).
create or replace function public.payment_register(
  p_tenant uuid, p_tab uuid, p_method uuid, p_amount_cents bigint, p_tendered_cents bigint,
  p_payer_label text, p_context text, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tab public.tabs;
  v_method public.payment_methods;
  v_payment public.payments;
  v_session uuid;
  v_tendered bigint;
  v_closed boolean;
begin
  if p_context = 'caixa' then
    perform private.authorize(p_tenant, 'caixa.receber');
    v_session := private.open_session_of_current_user(p_tenant);
    if v_session is null then
      perform private.fail('CASH_CLOSED', 'Abra o caixa antes de receber.');
    end if;
  elsif p_context = 'atendimento' then
    perform private.authorize(p_tenant, 'atendimento.pagamento.receber');
    v_session := private.open_session_of_current_user(p_tenant);
  elsif p_context = 'delivery' then
    perform private.authorize(p_tenant, 'delivery.pedido.despachar');
    v_session := private.open_session_of_current_user(p_tenant);
  else
    perform private.fail('INVALID', 'Contexto de recebimento inválido.');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    perform private.fail('INVALID', 'Chave de idempotência obrigatória.');
  end if;

  select * into v_payment from public.payments where tenant_id = p_tenant and idempotency_key = p_idempotency_key;
  if found then
    if v_payment.tab_id <> p_tab or v_payment.amount_cents <> p_amount_cents then
      perform private.fail('IDEMPOTENCY_CONFLICT', 'Operação duplicada com dados diferentes.');
    end if;
    return jsonb_build_object('payment', to_jsonb(v_payment), 'tab', private.tab_json(p_tab), 'duplicate', true);
  end if;

  v_tab := private.lock_tab(p_tenant, p_tab);
  if v_tab.status <> 'open' then
    perform private.fail('TAB_CLOSED', 'A comanda já está encerrada.');
  end if;
  v_tab := private.recalc_tab(p_tab);
  if p_amount_cents is null or p_amount_cents <= 0 then
    perform private.fail('INVALID', 'Informe um valor maior que zero.');
  end if;
  if p_amount_cents > v_tab.total_cents - v_tab.paid_cents then
    perform private.fail('OVERPAYMENT', 'O valor excede o saldo da comanda.');
  end if;
  select * into v_method from public.payment_methods where id = p_method and tenant_id = p_tenant and active;
  if not found then perform private.fail('INVALID', 'Método de pagamento indisponível.'); end if;
  if v_method.kind = 'dinheiro' then
    v_tendered := coalesce(p_tendered_cents, p_amount_cents);
    if v_tendered < p_amount_cents then
      perform private.fail('INVALID', 'Valor entregue menor que o valor a receber.');
    end if;
  else
    v_tendered := p_amount_cents;
  end if;

  insert into public.payments (tenant_id, tab_id, cash_session_id, method_id, method_kind, amount_cents, tendered_cents,
    change_cents, payer_label, context, received_by, business_day, receipt_number, idempotency_key)
  values (p_tenant, p_tab, v_session, p_method, v_method.kind, p_amount_cents, v_tendered, v_tendered - p_amount_cents,
    nullif(trim(coalesce(p_payer_label, '')), ''), p_context, (select auth.uid()), private.business_day(p_tenant),
    private.next_number(p_tenant, 'receipt'), p_idempotency_key)
  returning * into v_payment;

  perform private.recalc_tab(p_tab);
  perform private.audit(p_tenant, case p_context when 'caixa' then 'caixa' when 'delivery' then 'delivery' else 'atendimento' end::public.app_module,
    'payment.received', 'payment', v_payment.id::text,
    jsonb_build_object('tab', v_tab.number, 'amount_cents', p_amount_cents, 'method', v_method.name, 'change_cents', v_payment.change_cents));
  v_closed := private.try_autoclose(p_tab);
  return jsonb_build_object('payment', to_jsonb(v_payment), 'tab', private.tab_json(p_tab), 'closed', v_closed, 'duplicate', false);
end $$;

-- Desconto na comanda (valor total do desconto), sujeito a limite/aprovação.
create or replace function public.tab_set_discount(p_tenant uuid, p_tab uuid, p_discount_cents bigint, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tab public.tabs;
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'caixa.desconto', p_discount_cents);
  if coalesce(trim(p_reason), '') = '' then perform private.fail('INVALID', 'Informe o motivo do desconto.'); end if;
  v_tab := private.lock_tab(p_tenant, p_tab);
  if v_tab.status <> 'open' then perform private.fail('TAB_CLOSED', 'A comanda não está aberta.'); end if;
  if p_discount_cents < 0 or p_discount_cents > v_tab.subtotal_cents + v_tab.service_fee_cents + v_tab.delivery_fee_cents then
    perform private.fail('INVALID', 'Desconto inválido.');
  end if;
  update public.tabs set discount_cents = p_discount_cents where id = p_tab;
  v_tab := private.recalc_tab(p_tab);
  if v_tab.paid_cents > v_tab.total_cents then
    perform private.fail('INVALID', 'O desconto deixaria a comanda com valor recebido acima do total.');
  end if;
  perform private.audit(p_tenant, 'caixa', 'tab.discount', 'tab', p_tab::text,
    jsonb_build_object('number', v_tab.number, 'discount_cents', p_discount_cents, 'reason', p_reason), v_approval);
  perform private.try_autoclose(p_tab);
  return private.tab_json(p_tab);
end $$;

-- Estorno de pagamento: a comanda volta a ter saldo e é reaberta se necessário.
create or replace function public.payment_refund(p_tenant uuid, p_payment uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_payment public.payments;
  v_tab public.tabs;
  v_approval uuid;
  v_session uuid;
begin
  select * into v_payment from public.payments where id = p_payment and tenant_id = p_tenant;
  if not found then perform private.fail('NOT_FOUND', 'Pagamento não encontrado.'); end if;
  v_approval := private.authorize(p_tenant, 'caixa.estorno', v_payment.amount_cents);
  if coalesce(trim(p_reason), '') = '' then perform private.fail('INVALID', 'Informe o motivo do estorno.'); end if;
  v_tab := private.lock_tab(p_tenant, v_payment.tab_id);
  select * into v_payment from public.payments where id = p_payment for update;
  if v_payment.status = 'refunded' then
    return private.tab_json(v_payment.tab_id);
  end if;
  v_session := private.open_session_of_current_user(p_tenant);
  if v_payment.method_kind = 'dinheiro' and v_session is null then
    perform private.fail('CASH_CLOSED', 'Abra o caixa para estornar pagamentos em dinheiro.');
  end if;
  update public.payments set status = 'refunded', refunded_at = now(), refunded_by = (select auth.uid()),
    refund_session_id = v_session, refund_reason = trim(p_reason) where id = p_payment;
  if v_tab.status = 'closed' then
    update public.tabs set status = 'open', closed_at = null, closed_by = null,
      table_id = case when exists (select 1 from public.tabs o where o.table_id = v_tab.table_id and o.status = 'open') then null else table_id end
      where id = v_tab.id;
  end if;
  perform private.recalc_tab(v_tab.id);
  perform private.audit(p_tenant, 'caixa', 'payment.refunded', 'payment', p_payment::text,
    jsonb_build_object('tab', v_tab.number, 'amount_cents', v_payment.amount_cents, 'reason', p_reason), v_approval);
  return private.tab_json(v_tab.id);
end $$;

create or replace function public.cash_movement_register(
  p_tenant uuid, p_kind text, p_amount_cents bigint, p_reason text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_session uuid;
  v_id uuid;
  v_approval uuid;
begin
  if p_kind = 'sangria' then
    v_approval := private.authorize(p_tenant, 'caixa.sangria', p_amount_cents);
  elsif p_kind = 'suprimento' then
    v_approval := private.authorize(p_tenant, 'caixa.suprimento');
  else
    perform private.fail('INVALID', 'Movimentação inválida.');
  end if;
  select id into v_id from public.cash_movements where tenant_id = p_tenant and idempotency_key = p_idempotency_key;
  if found then return v_id; end if;
  v_session := private.open_session_of_current_user(p_tenant);
  if v_session is null then perform private.fail('CASH_CLOSED', 'Abra o caixa antes de movimentar.'); end if;
  if p_amount_cents is null or p_amount_cents <= 0 then perform private.fail('INVALID', 'Informe um valor maior que zero.'); end if;
  if coalesce(trim(p_reason), '') = '' then perform private.fail('INVALID', 'Informe o motivo.'); end if;
  insert into public.cash_movements (tenant_id, cash_session_id, kind, amount_cents, reason, created_by, idempotency_key)
    values (p_tenant, v_session, p_kind, p_amount_cents, trim(p_reason), (select auth.uid()), p_idempotency_key)
    returning id into v_id;
  perform private.audit(p_tenant, 'caixa', 'cash.' || p_kind, 'cash_movement', v_id::text,
    jsonb_build_object('amount_cents', p_amount_cents, 'reason', p_reason), v_approval);
  return v_id;
end $$;

-- Valores esperados por método na sessão (para conferência).
create or replace function public.cash_session_expected(p_tenant uuid, p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_session public.cash_sessions;
  v_result jsonb;
begin
  select * into v_session from public.cash_sessions where id = p_session and tenant_id = p_tenant;
  if not found then perform private.fail('NOT_FOUND', 'Caixa não encontrado.'); end if;
  if v_session.operator_id <> (select auth.uid()) and not private.is_owner(p_tenant)
     and private.evaluate_permission((select auth.uid()), p_tenant, 'caixa.historico.visualizar') <> 'direct' then
    perform private.fail('FORBIDDEN', 'Você não tem acesso a este caixa.');
  end if;
  with methods as (
    select pm.id, pm.name, pm.kind from public.payment_methods pm where pm.tenant_id = p_tenant
  ), received as (
    select method_id, sum(amount_cents) as v from public.payments
    where cash_session_id = p_session group by method_id
  ), refunded as (
    select method_id, sum(amount_cents) as v from public.payments
    where refund_session_id = p_session and status = 'refunded' group by method_id
  ), moves as (
    select coalesce(sum(case when kind = 'suprimento' then amount_cents else -amount_cents end), 0) as v
    from public.cash_movements where cash_session_id = p_session
  )
  select jsonb_build_object(
    'opening_cents', v_session.opening_cents,
    'movements_cents', (select v from moves),
    'methods', coalesce(jsonb_agg(jsonb_build_object(
      'method_id', m.id, 'name', m.name, 'kind', m.kind,
      'received_cents', coalesce(r.v, 0), 'refunded_cents', coalesce(f.v, 0),
      'expected_cents', coalesce(r.v, 0) - coalesce(f.v, 0)
        + case when m.kind = 'dinheiro' then v_session.opening_cents + (select v from moves) else 0 end
    ) order by m.kind, m.name) filter (where r.v is not null or f.v is not null or m.kind = 'dinheiro'), '[]'::jsonb)
  ) into v_result
  from methods m left join received r on r.method_id = m.id left join refunded f on f.method_id = m.id;
  return v_result;
end $$;

-- Fechamento: conferência por método e registro de divergências.
-- Comandas abertas não impedem o fechamento do turno.
create or replace function public.cash_session_close(p_tenant uuid, p_session uuid, p_counted jsonb, p_notes text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_session public.cash_sessions;
  v_expected jsonb;
  v_divergence bigint := 0;
  v_m jsonb;
begin
  perform private.authorize(p_tenant, 'caixa.fechar');
  select * into v_session from public.cash_sessions where id = p_session and tenant_id = p_tenant for update;
  if not found then perform private.fail('NOT_FOUND', 'Caixa não encontrado.'); end if;
  if v_session.status = 'closed' then
    return to_jsonb(v_session);
  end if;
  if v_session.operator_id <> (select auth.uid()) and not private.is_owner(p_tenant) then
    perform private.fail('FORBIDDEN', 'Somente o operador ou o titular fecha este caixa.');
  end if;
  v_expected := public.cash_session_expected(p_tenant, p_session);
  for v_m in select * from jsonb_array_elements(v_expected -> 'methods') loop
    v_divergence := v_divergence + coalesce((p_counted ->> (v_m ->> 'method_id'))::bigint, 0) - (v_m ->> 'expected_cents')::bigint;
  end loop;
  if v_divergence <> 0 and coalesce(trim(p_notes), '') = '' then
    perform private.fail('DIVERGENCE_NOTE_REQUIRED', 'Há divergência na conferência. Registre uma justificativa.');
  end if;
  update public.cash_sessions set status = 'closed', closed_at = now(), closed_by = (select auth.uid()),
    expected = v_expected, counted = coalesce(p_counted, '{}'::jsonb), divergence_cents = v_divergence,
    notes = nullif(trim(coalesce(p_notes, '')), '')
    where id = p_session returning * into v_session;
  perform private.audit(p_tenant, 'caixa', 'cash.closed', 'cash_session', p_session::text,
    jsonb_build_object('divergence_cents', v_divergence, 'counted', p_counted));
  return to_jsonb(v_session);
end $$;

-- ---------------------------------------------------------------------------
-- Delivery (lado do restaurante)
-- ---------------------------------------------------------------------------
create or replace function public.delivery_review(p_tenant uuid, p_tab uuid, p_accept boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_delivery public.delivery_orders;
begin
  perform private.authorize(p_tenant, 'delivery.pedido.aceitar');
  perform private.lock_tab(p_tenant, p_tab);
  select * into v_delivery from public.delivery_orders where tab_id = p_tab and tenant_id = p_tenant for update;
  if not found then perform private.fail('NOT_FOUND', 'Pedido de delivery não encontrado.'); end if;
  if v_delivery.status <> 'awaiting_acceptance' then
    perform private.fail('INVALID_STATE', 'Este pedido já foi analisado.');
  end if;
  if p_accept then
    update public.delivery_orders set status = 'accepted', accepted_at = now(), accepted_by = (select auth.uid()) where tab_id = p_tab;
    update public.orders set status = 'confirmed', confirmed_at = now() where tab_id = p_tab and status = 'pending_confirmation';
  else
    if coalesce(trim(p_reason), '') = '' then perform private.fail('INVALID', 'Informe o motivo da recusa.'); end if;
    update public.delivery_orders set status = 'rejected', rejected_reason = trim(p_reason) where tab_id = p_tab;
    update public.orders set status = 'rejected', cancelled_at = now(), cancelled_by = (select auth.uid()), cancel_reason = trim(p_reason)
      where tab_id = p_tab and status = 'pending_confirmation';
    update public.tabs set status = 'cancelled', closed_at = now(), closed_by = (select auth.uid()) where id = p_tab;
  end if;
  perform private.recalc_tab(p_tab);
  perform private.audit(p_tenant, 'delivery', case when p_accept then 'delivery.accepted' else 'delivery.rejected' end,
    'tab', p_tab::text, jsonb_build_object('reason', p_reason));
  return private.tab_json(p_tab);
end $$;

create or replace function public.delivery_dispatch(p_tenant uuid, p_tab uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_delivery public.delivery_orders;
begin
  perform private.authorize(p_tenant, 'delivery.pedido.despachar');
  perform private.lock_tab(p_tenant, p_tab);
  select * into v_delivery from public.delivery_orders where tab_id = p_tab and tenant_id = p_tenant for update;
  if not found then perform private.fail('NOT_FOUND', 'Pedido de delivery não encontrado.'); end if;
  if v_delivery.status <> 'accepted' then
    perform private.fail('INVALID_STATE', 'O pedido precisa estar aceito para sair para entrega.');
  end if;
  if exists (select 1 from public.orders where tab_id = p_tab and status in ('confirmed', 'preparing', 'pending_confirmation')) then
    perform private.fail('NOT_READY', 'O pedido ainda está em preparo.');
  end if;
  update public.delivery_orders set status = 'out_for_delivery', dispatched_at = now() where tab_id = p_tab;
  perform private.audit(p_tenant, 'delivery', 'delivery.dispatched', 'tab', p_tab::text);
  return private.tab_json(p_tab);
end $$;

create or replace function public.delivery_complete(p_tenant uuid, p_tab uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_delivery public.delivery_orders;
begin
  perform private.authorize(p_tenant, 'delivery.pedido.despachar');
  perform private.lock_tab(p_tenant, p_tab);
  select * into v_delivery from public.delivery_orders where tab_id = p_tab and tenant_id = p_tenant for update;
  if not found then perform private.fail('NOT_FOUND', 'Pedido de delivery não encontrado.'); end if;
  if v_delivery.status = 'delivered' then return private.tab_json(p_tab); end if;
  if v_delivery.status <> 'out_for_delivery' then
    perform private.fail('INVALID_STATE', 'O pedido ainda não saiu para entrega.');
  end if;
  update public.delivery_orders set status = 'delivered', delivered_at = now(), delivered_by = (select auth.uid()) where tab_id = p_tab;
  update public.orders set status = 'delivered', delivered_at = now(), delivered_by = (select auth.uid())
    where tab_id = p_tab and status = 'ready';
  perform private.audit(p_tenant, 'delivery', 'delivery.delivered', 'tab', p_tab::text);
  perform private.recalc_tab(p_tab);
  perform private.try_autoclose(p_tab);
  return private.tab_json(p_tab);
end $$;
