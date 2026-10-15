-- Estoque: locais, lotes, validade, movimentações rastreáveis, inventário,
-- solicitações de materiais e recebimento de compras.

alter table public.purchase_requests
  add constraint purchase_requests_quotation_fk foreign key (approved_quotation_id) references public.quotations (id);
create index purchase_requests_quotation_idx on public.purchase_requests (approved_quotation_id);

create table public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'deposito' check (kind in ('deposito', 'camara_fria', 'freezer', 'setor', 'prateleira', 'outro')),
  parent_id uuid references public.stock_locations (id) on delete set null,
  active boolean not null default true,
  unique (tenant_id, name)
);
create index stock_locations_parent_idx on public.stock_locations (parent_id);

create table public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  material_id uuid not null references public.materials (id),
  location_id uuid not null references public.stock_locations (id),
  lot_code text,
  expires_on date,
  qty numeric(14, 3) not null default 0 check (qty >= 0),
  status text not null default 'available' check (status in ('available', 'blocked')),
  block_reason text,
  unit_cost_cents bigint,
  received_at timestamptz not null default now()
);
create index stock_lots_material_idx on public.stock_lots (tenant_id, material_id);
create index stock_lots_location_idx on public.stock_lots (location_id);
create index stock_lots_material_fk_idx on public.stock_lots (material_id);
create index stock_lots_expiry_idx on public.stock_lots (tenant_id, expires_on) where qty > 0;

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null check (kind in ('entrada', 'saida', 'transferencia', 'ajuste', 'perda', 'descarte')),
  material_id uuid not null references public.materials (id),
  lot_id uuid references public.stock_lots (id),
  to_lot_id uuid references public.stock_lots (id),
  from_location_id uuid references public.stock_locations (id),
  to_location_id uuid references public.stock_locations (id),
  qty numeric(14, 3) not null check (qty <> 0),
  reason text,
  ref_type text,
  ref_id uuid,
  approval_id uuid references public.approval_requests (id),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  idempotency_key text,
  unique (tenant_id, idempotency_key)
);
create index stock_movements_tenant_at_idx on public.stock_movements (tenant_id, created_at desc);
create index stock_movements_material_idx on public.stock_movements (material_id);
create index stock_movements_lot_idx on public.stock_movements (lot_id);
create index stock_movements_to_lot_idx on public.stock_movements (to_lot_id);
create index stock_movements_from_loc_idx on public.stock_movements (from_location_id);
create index stock_movements_to_loc_idx on public.stock_movements (to_location_id);
create index stock_movements_approval_idx on public.stock_movements (approval_id);

create table public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid references public.stock_locations (id),
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  notes text,
  started_by uuid not null references auth.users (id),
  started_at timestamptz not null default now(),
  closed_by uuid references auth.users (id),
  closed_at timestamptz
);
create index inventory_counts_tenant_idx on public.inventory_counts (tenant_id, started_at desc);
create index inventory_counts_location_idx on public.inventory_counts (location_id);

create table public.inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  count_id uuid not null references public.inventory_counts (id) on delete cascade,
  lot_id uuid not null references public.stock_lots (id),
  material_id uuid not null references public.materials (id),
  expected_qty numeric(14, 3) not null,
  counted_qty numeric(14, 3),
  unique (count_id, lot_id)
);
create index inventory_count_lines_lot_idx on public.inventory_count_lines (lot_id);
create index inventory_count_lines_material_idx on public.inventory_count_lines (material_id);

create table public.material_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  number bigint not null,
  sector_id uuid references public.sectors (id) on delete set null,
  status text not null default 'requested'
    check (status in ('requested', 'authorized', 'fulfilled', 'purchase_requested', 'rejected', 'cancelled')),
  notes text,
  needed_by date,
  requested_by uuid not null references auth.users (id),
  requested_at timestamptz not null default now(),
  authorized_by uuid references auth.users (id),
  fulfilled_by uuid references auth.users (id),
  fulfilled_at timestamptz,
  decision_note text,
  purchase_request_id uuid references public.purchase_requests (id),
  unique (tenant_id, number)
);
create index material_requests_tenant_status_idx on public.material_requests (tenant_id, status);
create index material_requests_sector_idx on public.material_requests (sector_id);
create index material_requests_purchase_idx on public.material_requests (purchase_request_id);

create table public.material_request_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  request_id uuid not null references public.material_requests (id) on delete cascade,
  material_id uuid not null references public.materials (id),
  quantity numeric(14, 3) not null check (quantity > 0),
  fulfilled_qty numeric(14, 3) not null default 0
);
create index material_request_items_request_idx on public.material_request_items (request_id);
create index material_request_items_material_idx on public.material_request_items (material_id);

alter table public.purchase_requests
  add constraint purchase_requests_material_request_fk foreign key (material_request_id) references public.material_requests (id);
create index purchase_requests_material_request_idx on public.purchase_requests (material_request_id);

alter table public.stock_locations enable row level security;
alter table public.stock_lots enable row level security;
alter table public.stock_movements enable row level security;
alter table public.inventory_counts enable row level security;
alter table public.inventory_count_lines enable row level security;
alter table public.material_requests enable row level security;
alter table public.material_request_items enable row level security;

create policy stock_locations_select on public.stock_locations for select to authenticated using ((select private.is_member(tenant_id)));
create policy stock_lots_select on public.stock_lots for select to authenticated using ((select private.is_member(tenant_id)));
create policy stock_movements_select on public.stock_movements for select to authenticated using ((select private.is_member(tenant_id)));
create policy inventory_counts_select on public.inventory_counts for select to authenticated using ((select private.is_member(tenant_id)));
create policy inventory_count_lines_select on public.inventory_count_lines for select to authenticated using ((select private.is_member(tenant_id)));
create policy material_requests_select on public.material_requests for select to authenticated using ((select private.is_member(tenant_id)));
create policy material_request_items_select on public.material_request_items for select to authenticated using ((select private.is_member(tenant_id)));

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------
create or replace function private.require_stock_internal(p_tenant uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_internal(p_tenant, 'estoque', 'O estoque');
end $$;

create or replace function private.lot_for_update(p_tenant uuid, p_lot uuid)
returns public.stock_lots language plpgsql security definer set search_path = '' as $$
declare v_lot public.stock_lots;
begin
  select * into v_lot from public.stock_lots where id = p_lot and tenant_id = p_tenant for update;
  if not found then perform private.fail('NOT_FOUND', 'Lote não encontrado.'); end if;
  return v_lot;
end $$;

-- Materiais vencidos ou bloqueados não são liberados para consumo/transferência.
create or replace function private.assert_lot_releasable(p_lot public.stock_lots)
returns void language plpgsql set search_path = '' as $$
begin
  if p_lot.status = 'blocked' then
    perform private.fail('LOT_BLOCKED', 'Lote bloqueado não pode ser liberado.');
  end if;
  if p_lot.expires_on is not null and p_lot.expires_on < current_date then
    perform private.fail('LOT_EXPIRED', 'Material vencido não pode ser liberado para consumo.');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Locais
-- ---------------------------------------------------------------------------
create or replace function public.stock_location_save(p_tenant uuid, p_id uuid, p_name text, p_kind text, p_parent uuid, p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id;
begin
  perform private.authorize(p_tenant, 'estoque.materiais.gerir');
  perform private.require_stock_internal(p_tenant);
  if v_id is null then
    insert into public.stock_locations (tenant_id, name, kind, parent_id, active)
      values (p_tenant, trim(p_name), coalesce(p_kind, 'deposito'), p_parent, coalesce(p_active, true)) returning id into v_id;
  else
    update public.stock_locations set name = trim(p_name), kind = coalesce(p_kind, kind), parent_id = p_parent, active = coalesce(p_active, active)
      where id = v_id and tenant_id = p_tenant;
    if not found then perform private.fail('NOT_FOUND', 'Local não encontrado.'); end if;
  end if;
  perform private.audit(p_tenant, 'estoque', 'location.saved', 'stock_location', v_id::text, jsonb_build_object('name', p_name));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Movimentações
-- ---------------------------------------------------------------------------
-- Entrada sem verificação de permissão: usada por stock_entry (autorizada) e
-- pela conferência de recebimento de compra (autorizada pelo Administrativo).
create or replace function private.do_stock_entry(
  p_tenant uuid, p_material uuid, p_location uuid, p_qty numeric, p_lot_code text, p_expires_on date,
  p_unit_cost_cents bigint, p_reason text, p_idempotency_key text, p_ref_type text, p_ref_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_lot uuid;
  v_existing uuid;
begin
  select lot_id into v_existing from public.stock_movements where tenant_id = p_tenant and idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;
  if p_qty is null or p_qty <= 0 then perform private.fail('INVALID', 'Quantidade inválida.'); end if;
  if not exists (select 1 from public.materials where id = p_material and tenant_id = p_tenant) then
    perform private.fail('INVALID', 'Material inválido.');
  end if;
  if not exists (select 1 from public.stock_locations where id = p_location and tenant_id = p_tenant and active) then
    perform private.fail('INVALID', 'Local inválido.');
  end if;
  if (select perishable from public.materials where id = p_material) and p_expires_on is null then
    perform private.fail('EXPIRY_REQUIRED', 'Informe a validade do material perecível.');
  end if;
  -- Mesmo material, local, lote e validade: soma ao lote existente
  select id into v_lot from public.stock_lots
    where tenant_id = p_tenant and material_id = p_material and location_id = p_location
      and coalesce(lot_code, '') = coalesce(trim(p_lot_code), '') and expires_on is not distinct from p_expires_on
      and status = 'available'
    for update;
  if v_lot is null then
    insert into public.stock_lots (tenant_id, material_id, location_id, lot_code, expires_on, qty, unit_cost_cents)
      values (p_tenant, p_material, p_location, nullif(trim(coalesce(p_lot_code, '')), ''), p_expires_on, p_qty, p_unit_cost_cents)
      returning id into v_lot;
  else
    update public.stock_lots set qty = qty + p_qty, unit_cost_cents = coalesce(p_unit_cost_cents, unit_cost_cents) where id = v_lot;
  end if;
  insert into public.stock_movements (tenant_id, kind, material_id, lot_id, to_location_id, qty, reason, ref_type, ref_id, created_by, idempotency_key)
    values (p_tenant, 'entrada', p_material, v_lot, p_location, p_qty, p_reason, p_ref_type, p_ref_id, (select auth.uid()), p_idempotency_key);
  perform private.audit(p_tenant, 'estoque', 'stock.entry', 'stock_lot', v_lot::text, jsonb_build_object('qty', p_qty, 'material', p_material));
  return v_lot;
end $$;

create or replace function public.stock_entry(
  p_tenant uuid, p_material uuid, p_location uuid, p_qty numeric, p_lot_code text, p_expires_on date,
  p_unit_cost_cents bigint, p_reason text, p_idempotency_key text, p_ref_type text default null, p_ref_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform private.authorize(p_tenant, 'estoque.entrada.registrar');
  perform private.require_stock_internal(p_tenant);
  return private.do_stock_entry(p_tenant, p_material, p_location, p_qty, p_lot_code, p_expires_on,
    p_unit_cost_cents, p_reason, p_idempotency_key, p_ref_type, p_ref_id);
end $$;

-- Saída, perda, descarte ou ajuste (positivo/negativo) sobre um lote.
create or replace function public.stock_out(
  p_tenant uuid, p_lot uuid, p_kind text, p_qty numeric, p_reason text, p_idempotency_key text,
  p_ref_type text default null, p_ref_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_lot public.stock_lots;
  v_approval uuid;
  v_value bigint;
begin
  if exists (select 1 from public.stock_movements where tenant_id = p_tenant and idempotency_key = p_idempotency_key) then
    return;
  end if;
  select * into v_lot from public.stock_lots where id = p_lot and tenant_id = p_tenant;
  if not found then perform private.fail('NOT_FOUND', 'Lote não encontrado.'); end if;
  v_value := case when v_lot.unit_cost_cents is null then null else round(abs(p_qty) * v_lot.unit_cost_cents) end;
  if p_kind = 'saida' then
    perform private.authorize(p_tenant, 'estoque.saida.registrar');
  elsif p_kind in ('perda', 'descarte') then
    v_approval := private.authorize(p_tenant, 'estoque.perda.registrar', v_value);
  elsif p_kind = 'ajuste' then
    v_approval := private.authorize(p_tenant, 'estoque.ajuste.registrar', v_value);
  else
    perform private.fail('INVALID', 'Movimentação inválida.');
  end if;
  perform private.require_stock_internal(p_tenant);
  if coalesce(trim(p_reason), '') = '' and p_kind <> 'saida' then
    perform private.fail('INVALID', 'Informe o motivo.');
  end if;
  v_lot := private.lot_for_update(p_tenant, p_lot);
  if p_kind = 'saida' then
    perform private.assert_lot_releasable(v_lot);
  end if;
  if p_kind = 'ajuste' then
    if p_qty = 0 or v_lot.qty + p_qty < 0 then perform private.fail('INVALID', 'Ajuste inválido.'); end if;
    update public.stock_lots set qty = qty + p_qty where id = p_lot;
  else
    if p_qty is null or p_qty <= 0 then perform private.fail('INVALID', 'Quantidade inválida.'); end if;
    if p_qty > v_lot.qty then perform private.fail('INSUFFICIENT_STOCK', 'Quantidade maior que o saldo do lote.'); end if;
    update public.stock_lots set qty = qty - p_qty where id = p_lot;
  end if;
  insert into public.stock_movements (tenant_id, kind, material_id, lot_id, from_location_id, qty, reason, ref_type, ref_id,
    approval_id, created_by, idempotency_key)
  values (p_tenant, p_kind, v_lot.material_id, p_lot, v_lot.location_id,
    case when p_kind = 'ajuste' then p_qty else -p_qty end, p_reason, p_ref_type, p_ref_id,
    coalesce(v_approval, nullif(current_setting('pdp.approval_id', true), '')::uuid), (select auth.uid()), p_idempotency_key);
  perform private.audit(p_tenant, 'estoque', 'stock.' || p_kind, 'stock_lot', p_lot::text,
    jsonb_build_object('qty', p_qty, 'reason', p_reason), v_approval);
end $$;

create or replace function public.stock_transfer(
  p_tenant uuid, p_lot uuid, p_to_location uuid, p_qty numeric, p_reason text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_lot public.stock_lots;
  v_to uuid;
begin
  perform private.authorize(p_tenant, 'estoque.transferir');
  perform private.require_stock_internal(p_tenant);
  if exists (select 1 from public.stock_movements where tenant_id = p_tenant and idempotency_key = p_idempotency_key) then
    return (select to_lot_id from public.stock_movements where tenant_id = p_tenant and idempotency_key = p_idempotency_key);
  end if;
  v_lot := private.lot_for_update(p_tenant, p_lot);
  perform private.assert_lot_releasable(v_lot);
  if p_qty is null or p_qty <= 0 or p_qty > v_lot.qty then perform private.fail('INVALID', 'Quantidade inválida.'); end if;
  if p_to_location = v_lot.location_id then perform private.fail('INVALID', 'Escolha um local diferente.'); end if;
  if not exists (select 1 from public.stock_locations where id = p_to_location and tenant_id = p_tenant and active) then
    perform private.fail('INVALID', 'Local de destino inválido.');
  end if;
  update public.stock_lots set qty = qty - p_qty where id = p_lot;
  select id into v_to from public.stock_lots
    where tenant_id = p_tenant and material_id = v_lot.material_id and location_id = p_to_location
      and lot_code is not distinct from v_lot.lot_code and expires_on is not distinct from v_lot.expires_on and status = 'available'
    for update;
  if v_to is null then
    insert into public.stock_lots (tenant_id, material_id, location_id, lot_code, expires_on, qty, unit_cost_cents, received_at)
      values (p_tenant, v_lot.material_id, p_to_location, v_lot.lot_code, v_lot.expires_on, p_qty, v_lot.unit_cost_cents, v_lot.received_at)
      returning id into v_to;
  else
    update public.stock_lots set qty = qty + p_qty where id = v_to;
  end if;
  insert into public.stock_movements (tenant_id, kind, material_id, lot_id, to_lot_id, from_location_id, to_location_id, qty, reason, created_by, idempotency_key)
    values (p_tenant, 'transferencia', v_lot.material_id, p_lot, v_to, v_lot.location_id, p_to_location, p_qty, p_reason, (select auth.uid()), p_idempotency_key);
  perform private.audit(p_tenant, 'estoque', 'stock.transfer', 'stock_lot', p_lot::text,
    jsonb_build_object('qty', p_qty, 'to_location', p_to_location));
  return v_to;
end $$;

create or replace function public.stock_lot_block(p_tenant uuid, p_lot uuid, p_blocked boolean, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_lot public.stock_lots;
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'estoque.lote.bloquear');
  v_lot := private.lot_for_update(p_tenant, p_lot);
  if p_blocked and coalesce(trim(p_reason), '') = '' then perform private.fail('INVALID', 'Informe o motivo do bloqueio.'); end if;
  update public.stock_lots set status = case when p_blocked then 'blocked' else 'available' end,
    block_reason = case when p_blocked then trim(p_reason) end where id = p_lot;
  perform private.audit(p_tenant, 'estoque', case when p_blocked then 'lot.blocked' else 'lot.released' end, 'stock_lot', p_lot::text,
    jsonb_build_object('reason', p_reason), v_approval);
end $$;

-- ---------------------------------------------------------------------------
-- Inventário / conferência
-- ---------------------------------------------------------------------------
create or replace function public.inventory_start(p_tenant uuid, p_location uuid, p_notes text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.authorize(p_tenant, 'estoque.inventario.executar');
  perform private.require_stock_internal(p_tenant);
  if exists (select 1 from public.inventory_counts where tenant_id = p_tenant and status = 'open'
             and (location_id is not distinct from p_location or location_id is null or p_location is null)) then
    perform private.fail('INVENTORY_OPEN', 'Já existe uma conferência aberta para este local.');
  end if;
  insert into public.inventory_counts (tenant_id, location_id, notes, started_by)
    values (p_tenant, p_location, p_notes, (select auth.uid())) returning id into v_id;
  insert into public.inventory_count_lines (tenant_id, count_id, lot_id, material_id, expected_qty)
    select p_tenant, v_id, l.id, l.material_id, l.qty from public.stock_lots l
    where l.tenant_id = p_tenant and (p_location is null or l.location_id = p_location) and l.qty > 0;
  perform private.audit(p_tenant, 'estoque', 'inventory.started', 'inventory_count', v_id::text, jsonb_build_object('location', p_location));
  return v_id;
end $$;

create or replace function public.inventory_count_line(p_tenant uuid, p_line uuid, p_counted numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.authorize(p_tenant, 'estoque.inventario.executar');
  if p_counted is null or p_counted < 0 then perform private.fail('INVALID', 'Quantidade inválida.'); end if;
  update public.inventory_count_lines l set counted_qty = p_counted
    from public.inventory_counts c
    where l.id = p_line and l.tenant_id = p_tenant and c.id = l.count_id and c.status = 'open';
  if not found then perform private.fail('INVALID_STATE', 'Conferência não está aberta.'); end if;
end $$;

-- Fecha a conferência: diferenças viram ajustes (exigem permissão de ajuste).
create or replace function public.inventory_close(p_tenant uuid, p_count uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_count public.inventory_counts;
  r record;
  v_adjusted int := 0;
begin
  perform private.authorize(p_tenant, 'estoque.inventario.executar');
  select * into v_count from public.inventory_counts where id = p_count and tenant_id = p_tenant for update;
  if not found or v_count.status <> 'open' then perform private.fail('INVALID_STATE', 'Conferência não está aberta.'); end if;
  if exists (select 1 from public.inventory_count_lines where count_id = p_count and counted_qty is null) then
    perform private.fail('INCOMPLETE', 'Informe a contagem de todos os itens.');
  end if;
  for r in
    select l.*, lot.qty as current_qty from public.inventory_count_lines l
    join public.stock_lots lot on lot.id = l.lot_id
    where l.count_id = p_count and l.counted_qty <> lot.qty
  loop
    perform public.stock_out(p_tenant, r.lot_id, 'ajuste', r.counted_qty - r.current_qty,
      'Inventário: contagem divergente', 'inv:' || p_count::text || ':' || r.lot_id::text, 'inventory_count', p_count);
    v_adjusted := v_adjusted + 1;
  end loop;
  update public.inventory_counts set status = 'closed', closed_by = (select auth.uid()), closed_at = now() where id = p_count;
  perform private.audit(p_tenant, 'estoque', 'inventory.closed', 'inventory_count', p_count::text, jsonb_build_object('adjusted', v_adjusted));
  return jsonb_build_object('adjusted', v_adjusted);
end $$;

-- ---------------------------------------------------------------------------
-- Solicitações de materiais (Cozinha/setores → Estoque → Compras)
-- ---------------------------------------------------------------------------
create or replace function public.material_request_create(p_tenant uuid, p_sector uuid, p_items jsonb, p_notes text, p_needed_by date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform private.authorize(p_tenant, 'estoque.solicitacao.criar');
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform private.fail('INVALID', 'Inclua ao menos um material.');
  end if;
  insert into public.material_requests (tenant_id, number, sector_id, notes, needed_by, requested_by)
    values (p_tenant, private.next_number(p_tenant, 'material_request'), p_sector, p_notes, p_needed_by, (select auth.uid()))
    returning id into v_id;
  insert into public.material_request_items (tenant_id, request_id, material_id, quantity)
    select p_tenant, v_id, m.id, (i ->> 'quantity')::numeric
    from jsonb_array_elements(p_items) i join public.materials m on m.id = (i ->> 'material_id')::uuid and m.tenant_id = p_tenant;
  perform private.audit(p_tenant, 'estoque', 'material_request.created', 'material_request', v_id::text, jsonb_build_object('items', p_items));
  return v_id;
end $$;

-- Administrativo autoriza o atendimento do suprimento.
create or replace function public.material_request_authorize(p_tenant uuid, p_request uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.authorize(p_tenant, 'financeiro.suprimentos.autorizar');
  update public.material_requests set status = case when p_approve then 'authorized' else 'rejected' end,
    authorized_by = (select auth.uid()), decision_note = p_note
    where id = p_request and tenant_id = p_tenant and status = 'requested';
  if not found then perform private.fail('INVALID_STATE', 'A solicitação não aguarda autorização.'); end if;
  perform private.audit(p_tenant, 'financeiro', case when p_approve then 'material_request.authorized' else 'material_request.rejected' end,
    'material_request', p_request::text, jsonb_build_object('note', p_note));
end $$;

-- Estoque separa e entrega: consome lotes válidos (FEFO — vence primeiro, sai primeiro).
create or replace function public.material_request_fulfill(p_tenant uuid, p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_req public.material_requests;
  v_item public.material_request_items;
  v_lot public.stock_lots;
  v_need numeric;
  v_take numeric;
  v_missing jsonb := '[]'::jsonb;
begin
  perform private.authorize(p_tenant, 'estoque.solicitacao.atender');
  perform private.require_stock_internal(p_tenant);
  select * into v_req from public.material_requests where id = p_request and tenant_id = p_tenant for update;
  if not found then perform private.fail('NOT_FOUND', 'Solicitação não encontrada.'); end if;
  if v_req.status not in ('requested', 'authorized') then
    perform private.fail('INVALID_STATE', 'A solicitação não está pendente.');
  end if;
  -- Verifica disponibilidade total antes de movimentar
  for v_item in select * from public.material_request_items where request_id = p_request loop
    if (select coalesce(sum(qty), 0) from public.stock_lots where tenant_id = p_tenant and material_id = v_item.material_id
        and status = 'available' and (expires_on is null or expires_on >= current_date)) < v_item.quantity - v_item.fulfilled_qty then
      v_missing := v_missing || jsonb_build_object('material_id', v_item.material_id, 'quantity', v_item.quantity - v_item.fulfilled_qty);
    end if;
  end loop;
  if jsonb_array_length(v_missing) > 0 then
    return jsonb_build_object('fulfilled', false, 'missing', v_missing);
  end if;
  for v_item in select * from public.material_request_items where request_id = p_request loop
    v_need := v_item.quantity - v_item.fulfilled_qty;
    for v_lot in
      select * from public.stock_lots where tenant_id = p_tenant and material_id = v_item.material_id and status = 'available'
        and qty > 0 and (expires_on is null or expires_on >= current_date)
      order by expires_on nulls last, received_at
      for update
    loop
      exit when v_need <= 0;
      v_take := least(v_need, v_lot.qty);
      update public.stock_lots set qty = qty - v_take where id = v_lot.id;
      insert into public.stock_movements (tenant_id, kind, material_id, lot_id, from_location_id, qty, reason, ref_type, ref_id, created_by)
        values (p_tenant, 'saida', v_item.material_id, v_lot.id, v_lot.location_id, -v_take,
          'Solicitação de material nº ' || v_req.number, 'material_request', p_request, (select auth.uid()));
      v_need := v_need - v_take;
    end loop;
    update public.material_request_items set fulfilled_qty = quantity where id = v_item.id;
  end loop;
  update public.material_requests set status = 'fulfilled', fulfilled_by = (select auth.uid()), fulfilled_at = now() where id = p_request;
  perform private.audit(p_tenant, 'estoque', 'material_request.fulfilled', 'material_request', p_request::text);
  return jsonb_build_object('fulfilled', true);
end $$;

-- Sem disponibilidade: gera solicitação de compra para o Administrativo.
create or replace function public.material_request_to_purchase(p_tenant uuid, p_request uuid, p_justification text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_req public.material_requests;
  v_pr uuid;
begin
  perform private.authorize(p_tenant, 'estoque.solicitacao.atender');
  select * into v_req from public.material_requests where id = p_request and tenant_id = p_tenant for update;
  if not found then perform private.fail('NOT_FOUND', 'Solicitação não encontrada.'); end if;
  if v_req.status not in ('requested', 'authorized') then
    perform private.fail('INVALID_STATE', 'A solicitação não está pendente.');
  end if;
  v_pr := public.purchase_request_create(p_tenant,
    coalesce(nullif(trim(p_justification), ''), 'Reposição para solicitação de material nº ' || v_req.number),
    v_req.needed_by,
    (select jsonb_agg(jsonb_build_object('material_id', i.material_id, 'quantity', i.quantity - i.fulfilled_qty, 'unit', m.unit))
       from public.material_request_items i join public.materials m on m.id = i.material_id where i.request_id = p_request),
    p_request);
  update public.material_requests set status = 'purchase_requested', purchase_request_id = v_pr where id = p_request;
  return v_pr;
end $$;

-- ---------------------------------------------------------------------------
-- Conferência de recebimento de compra (Administrativo/Estoque)
-- items: [{po_item_id, quantity, location_id, lot_code, expires_on}]
-- ---------------------------------------------------------------------------
create or replace function public.goods_receipt_register(
  p_tenant uuid, p_order uuid, p_items jsonb, p_invoice_number text, p_invoice_document uuid, p_notes text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_po public.purchase_orders;
  v_receipt uuid;
  v_item jsonb;
  v_poi public.purchase_order_items;
  v_qty numeric;
  v_stock_internal boolean := private.process_internal(p_tenant, 'estoque');
  v_total bigint := 0;
begin
  if private.evaluate_permission((select auth.uid()), p_tenant, 'financeiro.recebimento.conferir') = 'direct' then
    perform private.authorize(p_tenant, 'financeiro.recebimento.conferir');
  else
    perform private.authorize(p_tenant, 'estoque.entrada.registrar');
  end if;
  select id into v_receipt from public.goods_receipts where tenant_id = p_tenant and idempotency_key = p_idempotency_key;
  if found then return v_receipt; end if;
  select * into v_po from public.purchase_orders where id = p_order and tenant_id = p_tenant for update;
  if not found then perform private.fail('NOT_FOUND', 'Pedido de compra não encontrado.'); end if;
  if v_po.status not in ('issued', 'partially_received') then
    perform private.fail('INVALID_STATE', 'O pedido não aguarda recebimento.');
  end if;
  insert into public.goods_receipts (tenant_id, order_id, invoice_number, invoice_document_id, notes, received_by, idempotency_key)
    values (p_tenant, p_order, p_invoice_number, p_invoice_document, p_notes, (select auth.uid()), p_idempotency_key)
    returning id into v_receipt;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into v_poi from public.purchase_order_items where id = (v_item ->> 'po_item_id')::uuid and order_id = p_order for update;
    if not found then perform private.fail('INVALID', 'Item do pedido inválido.'); end if;
    v_qty := (v_item ->> 'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then continue; end if;
    if v_poi.received_qty + v_qty > v_poi.quantity then
      perform private.fail('OVER_RECEIPT', 'Quantidade recebida maior que a comprada para "' || v_poi.description || '".');
    end if;
    update public.purchase_order_items set received_qty = received_qty + v_qty where id = v_poi.id;
    v_total := v_total + round(v_qty * v_poi.unit_price_cents);
    -- Integração com Estoque apenas quando o Ponto do Pedido controla o estoque
    if v_stock_internal and v_poi.material_id is not null then
      if nullif(v_item ->> 'location_id', '') is null then
        perform private.fail('INVALID', 'Informe o local de armazenagem de "' || v_poi.description || '".');
      end if;
      perform private.do_stock_entry(p_tenant, v_poi.material_id, (v_item ->> 'location_id')::uuid, v_qty,
        v_item ->> 'lot_code', nullif(v_item ->> 'expires_on', '')::date, v_poi.unit_price_cents,
        'Recebimento do pedido de compra nº ' || v_po.number, 'gr:' || v_receipt::text || ':' || v_poi.id::text,
        'goods_receipt', v_receipt);
    end if;
  end loop;

  update public.purchase_orders set status = case
      when not exists (select 1 from public.purchase_order_items where order_id = p_order and received_qty < quantity) then 'received'
      else 'partially_received' end
    where id = p_order returning * into v_po;
  if v_po.status = 'received' and v_po.request_id is not null then
    update public.purchase_requests set status = 'received' where id = v_po.request_id;
    update public.material_requests set status = 'requested' where purchase_request_id = v_po.request_id and status = 'purchase_requested';
  end if;

  -- Obrigação financeira gerada quando contas a pagar é interno
  if private.process_internal(p_tenant, 'contas_pagar') and v_po.status = 'received'
     and not exists (select 1 from public.payables where purchase_order_id = p_order) then
    insert into public.payables (tenant_id, kind, supplier_id, purchase_order_id, description, category, amount_cents, due_date, document_id, created_by)
      values (p_tenant, 'compra', v_po.supplier_id, p_order, 'Pedido de compra nº ' || v_po.number, 'Compras', v_po.total_cents,
        current_date + v_po.payment_due_days, p_invoice_document, (select auth.uid()));
  end if;
  perform private.audit(p_tenant, 'financeiro', 'purchase.received', 'goods_receipt', v_receipt::text,
    jsonb_build_object('order', v_po.number, 'status', v_po.status, 'invoice', p_invoice_number));
  return v_receipt;
end $$;

-- Saldos consolidados por material (com alertas de mínimo e validade)
create or replace function public.stock_overview(p_tenant uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'material_id', m.id, 'name', m.name, 'category', m.category, 'unit', m.unit, 'min_qty', m.min_qty,
    'reorder_qty', m.reorder_qty, 'perishable', m.perishable,
    'available_qty', coalesce(s.available_qty, 0), 'blocked_qty', coalesce(s.blocked_qty, 0),
    'expired_qty', coalesce(s.expired_qty, 0), 'expiring_qty', coalesce(s.expiring_qty, 0),
    'next_expiry', s.next_expiry,
    'below_min', coalesce(s.available_qty, 0) < m.min_qty
  ) order by m.name), '[]'::jsonb)
  from public.materials m
  left join lateral (
    select
      sum(l.qty) filter (where l.status = 'available' and (l.expires_on is null or l.expires_on >= current_date)) as available_qty,
      sum(l.qty) filter (where l.status = 'blocked') as blocked_qty,
      sum(l.qty) filter (where l.status = 'available' and l.expires_on < current_date) as expired_qty,
      sum(l.qty) filter (where l.status = 'available' and l.expires_on between current_date and current_date + 7) as expiring_qty,
      min(l.expires_on) filter (where l.qty > 0 and l.expires_on >= current_date) as next_expiry
    from public.stock_lots l where l.material_id = m.id and l.qty > 0
  ) s on true
  where m.tenant_id = p_tenant and m.active and private.is_member(p_tenant)
$$;
