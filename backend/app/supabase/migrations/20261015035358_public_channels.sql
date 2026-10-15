-- Canais públicos: Cardápio Digital Local (QR Code por mesa) e Delivery.
-- O consumidor não faz login. O acesso é limitado por:
--  * token secreto da mesa (QR Code, renovável pela Gestão);
--  * chave do convidado (gerada no dispositivo) — o cliente só vê os próprios pedidos;
--  * token de acompanhamento do delivery.

create or replace function private.is_open_now(p_tenant uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_local timestamp;
  v_has_hours boolean;
begin
  select timezone into v_tz from public.tenants where id = p_tenant;
  select exists (select 1 from public.business_hours where tenant_id = p_tenant) into v_has_hours;
  if not v_has_hours then
    return true; -- sem horários cadastrados, o responsável controla pela ativação do canal
  end if;
  v_local := now() at time zone v_tz;
  return exists (
    select 1 from public.business_hours h
    where h.tenant_id = p_tenant and (
      (h.opens <= h.closes and h.weekday = extract(dow from v_local) and v_local::time >= h.opens and v_local::time < h.closes)
      or (h.opens > h.closes and (
        (h.weekday = extract(dow from v_local) and v_local::time >= h.opens)
        or (h.weekday = (extract(dow from v_local)::int + 6) % 7 and v_local::time < h.closes)))
    )
  );
end $$;

create or replace function private.public_catalog(p_tenant uuid, p_channel text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'description', c.description,
    'products', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'description', p.description, 'price_cents', p.price_cents,
        'image_path', p.image_path, 'available', p.available
      ) order by p.position, p.name), '[]'::jsonb)
      from public.products p
      where p.category_id = c.id and p.active and p_channel = any (p.channels)
    )
  ) order by c.position, c.name), '[]'::jsonb)
  from public.categories c
  where c.tenant_id = p_tenant and c.active
    and exists (select 1 from public.products p where p.category_id = c.id and p.active and p_channel = any (p.channels))
$$;

create or replace function private.valid_guest_key(p_key text)
returns boolean language sql immutable set search_path = '' as $$
  select p_key is not null and p_key ~ '^[A-Za-z0-9_-]{16,64}$'
$$;

-- ---------------------------------------------------------------------------
-- Cardápio local
-- ---------------------------------------------------------------------------
create or replace function public.public_table_menu(p_qr text, p_guest_key text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_table public.dining_tables;
  v_tenant public.tenants;
  v_tab public.tabs;
  v_my_orders jsonb := '[]'::jsonb;
begin
  select * into v_table from public.dining_tables where qr_token = p_qr and active;
  if not found then
    return jsonb_build_object('state', 'invalid_qr');
  end if;
  select * into v_tenant from public.tenants where id = v_table.tenant_id;
  if not private.tenant_operational(v_tenant.id) or not private.module_enabled(v_tenant.id, 'cardapio') then
    return jsonb_build_object('state', 'unavailable', 'tenant', jsonb_build_object('name', v_tenant.name, 'logo_path', v_tenant.logo_path));
  end if;

  select * into v_tab from public.tabs where table_id = v_table.id and status = 'open';
  if found and private.valid_guest_key(p_guest_key) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'number', o.number, 'status', o.status, 'created_at', o.created_at,
      'items', (select jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity, 'status', i.status,
                  'unit_price_cents', i.unit_price_cents, 'notes', i.notes)) from public.order_items i where i.order_id = o.id)
    ) order by o.created_at), '[]'::jsonb) into v_my_orders
    from public.orders o where o.tab_id = v_tab.id and o.guest_key = p_guest_key;
  end if;

  return jsonb_build_object(
    'state', 'ok',
    'tenant', jsonb_build_object('name', v_tenant.name, 'slug', v_tenant.slug, 'logo_path', v_tenant.logo_path),
    'table', jsonb_build_object('label', v_table.label),
    'mode', coalesce(v_tenant.settings ->> 'local_order_mode', 'garcom'),
    'confirmation', coalesce(v_tenant.settings ->> 'local_order_confirmation', 'atendente'),
    'service_fee_percent', coalesce((v_tenant.settings ->> 'service_fee_percent')::numeric, 0),
    'open_now', private.is_open_now(v_tenant.id),
    'categories', private.public_catalog(v_tenant.id, 'cardapio'),
    'my_orders', v_my_orders,
    'bill_requested', v_tab.bill_requested_at is not null and jsonb_array_length(v_my_orders) > 0
  );
end $$;

create or replace function public.public_table_order(
  p_qr text, p_guest_key text, p_items jsonb, p_notes text, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_table public.dining_tables;
  v_tenant public.tenants;
  v_tab public.tabs;
  v_order public.orders;
  v_mode text;
  v_auto boolean;
begin
  if not private.valid_guest_key(p_guest_key) or not private.valid_guest_key(p_idempotency_key) then
    perform private.fail('INVALID', 'Sessão do cardápio inválida. Recarregue a página.');
  end if;
  select * into v_order from public.orders where idempotency_key = 'qr:' || p_idempotency_key;
  if found then
    return jsonb_build_object('order_number', v_order.number, 'status', v_order.status, 'duplicate', true);
  end if;
  select * into v_table from public.dining_tables where qr_token = p_qr and active for update;
  if not found then perform private.fail('INVALID_QR', 'QR Code inválido. Solicite ajuda ao atendente.'); end if;
  select * into v_tenant from public.tenants where id = v_table.tenant_id;
  if not private.tenant_operational(v_tenant.id) or not private.module_enabled(v_tenant.id, 'cardapio') then
    perform private.fail('UNAVAILABLE', 'Cardápio indisponível no momento.');
  end if;
  v_mode := coalesce(v_tenant.settings ->> 'local_order_mode', 'garcom');
  if v_mode not in ('cliente', 'ambos') then
    perform private.fail('ORDERING_DISABLED', 'Os pedidos desta mesa são registrados pelo garçom.');
  end if;
  if not private.is_open_now(v_tenant.id) then
    perform private.fail('CLOSED', 'O restaurante está fechado no momento.');
  end if;
  v_auto := coalesce(v_tenant.settings ->> 'local_order_confirmation', 'atendente') = 'automatica';

  select * into v_tab from public.tabs where table_id = v_table.id and status = 'open' for update;
  if not found then
    insert into public.tabs (tenant_id, number, table_id, channel, service_fee_percent, business_day)
      values (v_tenant.id, private.next_number(v_tenant.id, 'tab'), v_table.id, 'salao',
        coalesce((v_tenant.settings ->> 'service_fee_percent')::numeric, 0), private.business_day(v_tenant.id))
      returning * into v_tab;
  end if;
  if (select count(*) from public.orders where tab_id = v_tab.id and status = 'pending_confirmation') >= 5 then
    perform private.fail('TOO_MANY_PENDING', 'Aguarde a confirmação dos pedidos anteriores.');
  end if;

  insert into public.orders (tenant_id, tab_id, number, source, status, notes, guest_key, idempotency_key, business_day, confirmed_at, delivery_by)
  values (v_tenant.id, v_tab.id, private.next_number(v_tenant.id, 'order'), 'cardapio',
    case when v_auto then 'confirmed' else 'pending_confirmation' end::public.order_status,
    nullif(left(trim(coalesce(p_notes, '')), 300), ''), p_guest_key, 'qr:' || p_idempotency_key,
    private.business_day(v_tenant.id), case when v_auto then now() end,
    case when coalesce((v_tenant.settings ->> 'kitchen_delivers')::boolean, false) then 'cozinha' else 'atendimento' end)
  returning * into v_order;
  perform private.insert_order_items(v_tenant.id, v_order.id, p_items, 'cardapio');
  perform private.recalc_tab(v_tab.id);
  insert into public.audit_log (tenant_id, module, action, entity, entity_id, data)
    values (v_tenant.id, 'cardapio', 'order.customer_created', 'order', v_order.id::text,
      jsonb_build_object('number', v_order.number, 'table', v_table.label));
  return jsonb_build_object('order_number', v_order.number, 'status', v_order.status, 'duplicate', false);
end $$;

create or replace function public.public_table_request_bill(p_qr text, p_guest_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_table public.dining_tables;
  v_tab public.tabs;
begin
  select * into v_table from public.dining_tables where qr_token = p_qr and active;
  if not found then perform private.fail('INVALID_QR', 'QR Code inválido.'); end if;
  select * into v_tab from public.tabs where table_id = v_table.id and status = 'open' for update;
  if not found or not exists (select 1 from public.orders where tab_id = v_tab.id and guest_key = p_guest_key) then
    perform private.fail('NO_TAB', 'Não há consumo registrado por você nesta mesa.');
  end if;
  update public.tabs set bill_requested_at = coalesce(bill_requested_at, now()), bill_requested_by = coalesce(bill_requested_by, 'cliente')
    where id = v_tab.id;
  insert into public.audit_log (tenant_id, module, action, entity, entity_id, data)
    values (v_tab.tenant_id, 'cardapio', 'tab.bill_requested_by_customer', 'tab', v_tab.id::text, jsonb_build_object('table', v_table.label));
  return jsonb_build_object('requested', true);
end $$;


-- Cardápio para consulta (sem mesa): não permite pedidos.
create or replace function public.public_menu(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_tenant public.tenants;
begin
  select * into v_tenant from public.tenants where slug = lower(trim(p_slug));
  if not found then return jsonb_build_object('state', 'not_found'); end if;
  if not private.tenant_operational(v_tenant.id) or not private.module_enabled(v_tenant.id, 'cardapio') then
    return jsonb_build_object('state', 'unavailable', 'tenant', jsonb_build_object('name', v_tenant.name, 'logo_path', v_tenant.logo_path));
  end if;
  return jsonb_build_object(
    'state', 'ok',
    'tenant', jsonb_build_object('name', v_tenant.name, 'slug', v_tenant.slug, 'logo_path', v_tenant.logo_path),
    'open_now', private.is_open_now(v_tenant.id),
    'service_fee_percent', coalesce((v_tenant.settings ->> 'service_fee_percent')::numeric, 0),
    'categories', private.public_catalog(v_tenant.id, 'cardapio')
  );
end $$;

-- ---------------------------------------------------------------------------
-- Delivery
-- ---------------------------------------------------------------------------
create or replace function public.public_delivery_menu(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_tenant public.tenants;
begin
  select * into v_tenant from public.tenants where slug = lower(trim(p_slug));
  if not found then return jsonb_build_object('state', 'not_found'); end if;
  if not private.tenant_operational(v_tenant.id) or not private.module_enabled(v_tenant.id, 'delivery')
     or not coalesce((v_tenant.settings ->> 'delivery_enabled')::boolean, false) then
    return jsonb_build_object('state', 'unavailable', 'tenant', jsonb_build_object('name', v_tenant.name, 'logo_path', v_tenant.logo_path));
  end if;
  return jsonb_build_object(
    'state', 'ok',
    'tenant', jsonb_build_object('name', v_tenant.name, 'slug', v_tenant.slug, 'logo_path', v_tenant.logo_path,
      'phone', v_tenant.phone, 'whatsapp', v_tenant.settings ->> 'delivery_whatsapp'),
    'open_now', private.is_open_now(v_tenant.id),
    'eta_minutes', (v_tenant.settings ->> 'delivery_eta_minutes')::int,
    'zones', coalesce((select jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'neighborhoods', z.neighborhoods,
        'fee_cents', z.fee_cents, 'min_order_cents', z.min_order_cents, 'eta_minutes', z.eta_minutes) order by z.name)
      from public.delivery_zones z where z.tenant_id = v_tenant.id and z.active), '[]'::jsonb),
    'payment_methods', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'kind', m.kind) order by m.position, m.name)
      from public.payment_methods m where m.tenant_id = v_tenant.id and m.active and 'delivery' = any (m.channels)), '[]'::jsonb),
    'hours', coalesce((select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'opens', h.opens, 'closes', h.closes) order by h.weekday, h.opens)
      from public.business_hours h where h.tenant_id = v_tenant.id), '[]'::jsonb),
    'categories', private.public_catalog(v_tenant.id, 'delivery')
  );
end $$;

create or replace function public.public_delivery_order(
  p_slug text, p_customer jsonb, p_address jsonb, p_zone uuid, p_items jsonb, p_notes text,
  p_payment_method uuid, p_change_for_cents bigint, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tenant public.tenants;
  v_zone public.delivery_zones;
  v_tab public.tabs;
  v_order public.orders;
  v_delivery public.delivery_orders;
  v_whatsapp text := regexp_replace(coalesce(p_customer ->> 'whatsapp', ''), '\D', '', 'g');
  v_name text := left(trim(coalesce(p_customer ->> 'name', '')), 80);
begin
  if not private.valid_guest_key(p_idempotency_key) then
    perform private.fail('INVALID', 'Sessão inválida. Recarregue a página.');
  end if;
  select d.* into v_delivery from public.orders o join public.delivery_orders d on d.tab_id = o.tab_id
    where o.idempotency_key = 'dl:' || p_idempotency_key;
  if found then
    return jsonb_build_object('tracking_token', v_delivery.tracking_token, 'duplicate', true);
  end if;

  select * into v_tenant from public.tenants where slug = lower(trim(p_slug));
  if not found or not private.tenant_operational(v_tenant.id) or not private.module_enabled(v_tenant.id, 'delivery')
     or not coalesce((v_tenant.settings ->> 'delivery_enabled')::boolean, false) then
    perform private.fail('UNAVAILABLE', 'Delivery indisponível no momento.');
  end if;
  if not private.is_open_now(v_tenant.id) then
    perform private.fail('CLOSED', 'O restaurante está fechado no momento.');
  end if;
  if char_length(v_whatsapp) < 10 or char_length(v_whatsapp) > 13 then
    perform private.fail('INVALID_WHATSAPP', 'Informe um WhatsApp válido com DDD.');
  end if;
  if char_length(v_name) < 2 then
    perform private.fail('INVALID', 'Informe seu nome.');
  end if;
  if coalesce(trim(p_address ->> 'street'), '') = '' or coalesce(trim(p_address ->> 'number'), '') = ''
     or coalesce(trim(p_address ->> 'neighborhood'), '') = '' then
    perform private.fail('INVALID_ADDRESS', 'Informe rua, número e bairro.');
  end if;
  select * into v_zone from public.delivery_zones where id = p_zone and tenant_id = v_tenant.id and active;
  if not found then
    perform private.fail('OUT_OF_AREA', 'Não entregamos nesta região.');
  end if;
  if (select count(*) from public.delivery_orders where tenant_id = v_tenant.id and whatsapp = v_whatsapp
      and status = 'awaiting_acceptance') >= 3 then
    perform private.fail('TOO_MANY_PENDING', 'Você já possui pedidos aguardando confirmação.');
  end if;
  if p_payment_method is not null and not exists (
    select 1 from public.payment_methods where id = p_payment_method and tenant_id = v_tenant.id and active and 'delivery' = any (channels)
  ) then
    perform private.fail('INVALID', 'Forma de pagamento indisponível.');
  end if;

  insert into public.tabs (tenant_id, number, channel, customer_name, delivery_fee_cents, business_day)
    values (v_tenant.id, private.next_number(v_tenant.id, 'tab'), 'delivery', v_name, v_zone.fee_cents, private.business_day(v_tenant.id))
    returning * into v_tab;
  insert into public.orders (tenant_id, tab_id, number, source, status, notes, idempotency_key, business_day, delivery_by)
    values (v_tenant.id, v_tab.id, private.next_number(v_tenant.id, 'order'), 'delivery', 'pending_confirmation',
      nullif(left(trim(coalesce(p_notes, '')), 300), ''), 'dl:' || p_idempotency_key, private.business_day(v_tenant.id), 'entregador')
    returning * into v_order;
  perform private.insert_order_items(v_tenant.id, v_order.id, p_items, 'delivery');

  -- Valor mínimo considera os itens (sem taxa)
  if (select coalesce(sum(unit_price_cents * quantity), 0) from public.order_items where order_id = v_order.id) < v_zone.min_order_cents then
    perform private.fail('MIN_ORDER', 'Pedido abaixo do valor mínimo para esta região.');
  end if;

  insert into public.delivery_orders (tab_id, tenant_id, customer_name, whatsapp, address, zone_id, fee_cents,
    payment_method_id, change_for_cents, notes)
  values (v_tab.id, v_tenant.id, v_name, v_whatsapp,
    jsonb_build_object('street', left(trim(p_address ->> 'street'), 120), 'number', left(trim(p_address ->> 'number'), 20),
      'complement', left(trim(coalesce(p_address ->> 'complement', '')), 80),
      'neighborhood', left(trim(p_address ->> 'neighborhood'), 80), 'reference', left(trim(coalesce(p_address ->> 'reference', '')), 120)),
    v_zone.id, v_zone.fee_cents, p_payment_method, p_change_for_cents, nullif(left(trim(coalesce(p_notes, '')), 300), ''))
  returning * into v_delivery;

  -- Subtotal estimado para exibição; a comanda só considera itens após a aceitação.
  update public.tabs set total_cents = v_zone.fee_cents where id = v_tab.id;
  insert into public.audit_log (tenant_id, module, action, entity, entity_id, data)
    values (v_tenant.id, 'delivery', 'delivery.created', 'tab', v_tab.id::text, jsonb_build_object('number', v_tab.number, 'zone', v_zone.name));
  return jsonb_build_object('tracking_token', v_delivery.tracking_token, 'duplicate', false);
end $$;

create or replace function public.public_delivery_tracking(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'state', 'ok',
    'tenant', jsonb_build_object('name', t.name, 'slug', t.slug, 'logo_path', t.logo_path,
      'whatsapp', t.settings ->> 'delivery_whatsapp'),
    'number', tab.number,
    'status', d.status,
    'rejected_reason', d.rejected_reason,
    'created_at', d.created_at, 'accepted_at', d.accepted_at, 'dispatched_at', d.dispatched_at, 'delivered_at', d.delivered_at,
    'kitchen_status', (select case
        when bool_and(o.status in ('ready', 'delivered')) then 'ready'
        when bool_or(o.status = 'preparing') then 'preparing'
        else min(o.status::text) end from public.orders o where o.tab_id = tab.id and o.status not in ('cancelled', 'rejected')),
    'fee_cents', d.fee_cents,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity,
        'unit_price_cents', i.unit_price_cents, 'status', i.status, 'notes', i.notes)), '[]'::jsonb)
      from public.order_items i join public.orders o on o.id = i.order_id where o.tab_id = tab.id),
    'items_cents', (select coalesce(sum(i.unit_price_cents * i.quantity), 0)
      from public.order_items i join public.orders o on o.id = i.order_id where o.tab_id = tab.id and i.status = 'active'),
    'paid_cents', tab.paid_cents,
    'payment_method', (select m.name from public.payment_methods m where m.id = d.payment_method_id)
  )
  from public.delivery_orders d
  join public.tabs tab on tab.id = d.tab_id
  join public.tenants t on t.id = d.tenant_id
  where d.tracking_token = p_token
$$;
