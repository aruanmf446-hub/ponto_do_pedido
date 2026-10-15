-- Cadastros compartilhados (registro oficial único por estabelecimento):
-- setores, mesas, categorias, produtos, métodos de pagamento, taxas de entrega,
-- horários de funcionamento e suprimentos (materiais).

create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'salao' check (kind in ('salao', 'producao', 'estoque', 'administrativo', 'outro')),
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sector_id uuid references public.sectors (id) on delete set null,
  label text not null check (char_length(label) between 1 and 20),
  seats smallint not null default 4 check (seats between 1 and 99),
  active boolean not null default true,
  qr_token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, label)
);
create index dining_tables_sector_idx on public.dining_tables (sector_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '',
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  price_cents bigint not null check (price_cents >= 0),
  image_path text,
  available boolean not null default true,
  active boolean not null default true,
  channels text[] not null default array['salao', 'cardapio', 'delivery']
    check (channels <@ array['salao', 'cardapio', 'delivery']),
  prep_sector_id uuid references public.sectors (id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_tenant_category_idx on public.products (tenant_id, category_id);
create index products_category_idx on public.products (category_id);
create index products_prep_sector_idx on public.products (prep_sector_id);
create trigger products_touch before update on public.products
  for each row execute function private.touch_updated_at();

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null check (kind in ('dinheiro', 'pix', 'credito', 'debito', 'vale', 'outro')),
  name text not null check (char_length(name) between 1 and 40),
  active boolean not null default true,
  channels text[] not null default array['caixa', 'atendimento', 'delivery']
    check (channels <@ array['caixa', 'atendimento', 'delivery']),
  position int not null default 0,
  unique (tenant_id, name)
);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  neighborhoods text[] not null default '{}',
  fee_cents bigint not null default 0 check (fee_cents >= 0),
  min_order_cents bigint not null default 0 check (min_order_cents >= 0),
  eta_minutes int check (eta_minutes between 1 and 600),
  active boolean not null default true,
  unique (tenant_id, name)
);

create table public.business_hours (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time not null,
  closes time not null,
  primary key (tenant_id, weekday, opens)
);

-- Suprimentos/materiais: cadastro único usado por Estoque e Administrativo.
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null default 'Geral',
  unit text not null default 'un' check (unit in ('un', 'kg', 'g', 'l', 'ml', 'cx', 'pct', 'm')),
  sku text,
  min_qty numeric(14, 3) not null default 0 check (min_qty >= 0),
  reorder_qty numeric(14, 3) not null default 0 check (reorder_qty >= 0),
  perishable boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

alter table public.sectors enable row level security;
alter table public.dining_tables enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.payment_methods enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.business_hours enable row level security;
alter table public.materials enable row level security;

create policy sectors_select on public.sectors for select to authenticated using ((select private.is_member(tenant_id)));
create policy dining_tables_select on public.dining_tables for select to authenticated using ((select private.is_member(tenant_id)));
create policy categories_select on public.categories for select to authenticated using ((select private.is_member(tenant_id)));
create policy products_select on public.products for select to authenticated using ((select private.is_member(tenant_id)));
create policy payment_methods_select on public.payment_methods for select to authenticated using ((select private.is_member(tenant_id)));
create policy delivery_zones_select on public.delivery_zones for select to authenticated using ((select private.is_member(tenant_id)));
create policy business_hours_select on public.business_hours for select to authenticated using ((select private.is_member(tenant_id)));
create policy materials_select on public.materials for select to authenticated using ((select private.is_member(tenant_id)));

-- ---------------------------------------------------------------------------
-- RPCs de cadastro
-- ---------------------------------------------------------------------------
create or replace function public.sector_save(
  p_tenant uuid, p_id uuid, p_name text, p_kind text, p_active boolean, p_position int default 0
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, case when p_id is null then 'cadastros.setores.cadastrar' else 'cadastros.setores.alterar' end);
  if v_id is null then
    insert into public.sectors (tenant_id, name, kind, active, position)
      values (p_tenant, trim(p_name), coalesce(p_kind, 'salao'), coalesce(p_active, true), coalesce(p_position, 0))
      returning id into v_id;
  else
    update public.sectors set name = trim(p_name), kind = coalesce(p_kind, kind), active = coalesce(p_active, active),
      position = coalesce(p_position, position)
      where id = v_id and tenant_id = p_tenant;
    if not found then perform private.fail('NOT_FOUND', 'Setor não encontrado.'); end if;
  end if;
  perform private.audit(p_tenant, 'gestao', 'sector.saved', 'sector', v_id::text, jsonb_build_object('name', p_name), v_approval);
  return v_id;
end $$;

create or replace function public.sector_delete(p_tenant uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'cadastros.setores.excluir');
  delete from public.sectors where id = p_id and tenant_id = p_tenant;
  perform private.audit(p_tenant, 'gestao', 'sector.deleted', 'sector', p_id::text, '{}'::jsonb, v_approval);
end $$;

create or replace function public.table_save(
  p_tenant uuid, p_id uuid, p_label text, p_sector uuid, p_seats smallint, p_active boolean, p_position int default 0
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, case when p_id is null then 'cadastros.mesas.cadastrar' else 'cadastros.mesas.alterar' end);
  if p_sector is not null and not exists (select 1 from public.sectors where id = p_sector and tenant_id = p_tenant) then
    perform private.fail('INVALID', 'Setor inválido.');
  end if;
  if v_id is null then
    insert into public.dining_tables (tenant_id, label, sector_id, seats, active, position)
      values (p_tenant, trim(p_label), p_sector, coalesce(p_seats, 4), coalesce(p_active, true), coalesce(p_position, 0))
      returning id into v_id;
  else
    update public.dining_tables set label = trim(p_label), sector_id = p_sector, seats = coalesce(p_seats, seats),
      active = coalesce(p_active, active), position = coalesce(p_position, position)
      where id = v_id and tenant_id = p_tenant;
    if not found then perform private.fail('NOT_FOUND', 'Mesa não encontrada.'); end if;
  end if;
  perform private.audit(p_tenant, 'gestao', 'table.saved', 'dining_table', v_id::text, jsonb_build_object('label', p_label), v_approval);
  return v_id;
end $$;

-- Gera um novo QR Code para a mesa: links antigos deixam de funcionar.
create or replace function public.table_rotate_qr(p_tenant uuid, p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'cardapio.configurar');
  update public.dining_tables set qr_token = encode(extensions.gen_random_bytes(18), 'hex')
    where id = p_id and tenant_id = p_tenant returning qr_token into v_token;
  if v_token is null then perform private.fail('NOT_FOUND', 'Mesa não encontrada.'); end if;
  perform private.audit(p_tenant, 'cardapio', 'table.qr_rotated', 'dining_table', p_id::text, '{}'::jsonb, v_approval);
  return v_token;
end $$;

create or replace function public.category_save(
  p_tenant uuid, p_id uuid, p_name text, p_description text, p_position int, p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, case when p_id is null then 'cadastros.categorias.cadastrar' else 'cadastros.categorias.alterar' end);
  if v_id is null then
    insert into public.categories (tenant_id, name, description, position, active)
      values (p_tenant, trim(p_name), coalesce(p_description, ''), coalesce(p_position, 0), coalesce(p_active, true))
      returning id into v_id;
  else
    update public.categories set name = trim(p_name), description = coalesce(p_description, ''),
      position = coalesce(p_position, position), active = coalesce(p_active, active)
      where id = v_id and tenant_id = p_tenant;
    if not found then perform private.fail('NOT_FOUND', 'Categoria não encontrada.'); end if;
  end if;
  perform private.audit(p_tenant, 'gestao', 'category.saved', 'category', v_id::text, jsonb_build_object('name', p_name), v_approval);
  return v_id;
end $$;

create or replace function public.category_delete(p_tenant uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'cadastros.categorias.excluir');
  if exists (select 1 from public.products where category_id = p_id and active) then
    perform private.fail('IN_USE', 'Mova ou desative os produtos desta categoria antes de excluí-la.');
  end if;
  delete from public.categories where id = p_id and tenant_id = p_tenant;
  perform private.audit(p_tenant, 'gestao', 'category.deleted', 'category', p_id::text, '{}'::jsonb, v_approval);
end $$;

create or replace function public.product_save(
  p_tenant uuid, p_id uuid, p_category uuid, p_name text, p_description text, p_price_cents bigint,
  p_image_path text, p_available boolean, p_active boolean, p_channels text[], p_prep_sector uuid, p_position int
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_old public.products;
  v_approval uuid;
begin
  if p_category is not null and not exists (select 1 from public.categories where id = p_category and tenant_id = p_tenant) then
    perform private.fail('INVALID', 'Categoria inválida.');
  end if;
  if p_price_cents is null or p_price_cents < 0 then
    perform private.fail('INVALID', 'Informe um preço válido.');
  end if;
  if v_id is null then
    v_approval := private.authorize(p_tenant, 'cadastros.produtos.cadastrar');
    insert into public.products (tenant_id, category_id, name, description, price_cents, image_path, available, active, channels, prep_sector_id, position)
      values (p_tenant, p_category, trim(p_name), coalesce(p_description, ''), p_price_cents, p_image_path,
        coalesce(p_available, true), coalesce(p_active, true), coalesce(p_channels, array['salao', 'cardapio', 'delivery']),
        p_prep_sector, coalesce(p_position, 0))
      returning id into v_id;
  else
    select * into v_old from public.products where id = v_id and tenant_id = p_tenant for update;
    if not found then perform private.fail('NOT_FOUND', 'Produto não encontrado.'); end if;
    v_approval := private.authorize(p_tenant, 'cadastros.produtos.alterar');
    if v_old.price_cents <> p_price_cents then
      v_approval := coalesce(private.authorize(p_tenant, 'cadastros.precos.alterar'), v_approval);
    end if;
    update public.products set category_id = p_category, name = trim(p_name), description = coalesce(p_description, ''),
      price_cents = p_price_cents, image_path = p_image_path, available = coalesce(p_available, available),
      active = coalesce(p_active, active), channels = coalesce(p_channels, channels), prep_sector_id = p_prep_sector,
      position = coalesce(p_position, position)
      where id = v_id;
  end if;
  perform private.audit(p_tenant, 'gestao', 'product.saved', 'product', v_id::text,
    jsonb_build_object('name', p_name, 'price_cents', p_price_cents, 'previous_price_cents', v_old.price_cents), v_approval);
  return v_id;
end $$;

create or replace function public.product_delete(p_tenant uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'cadastros.produtos.excluir');
  -- Produtos são desativados para preservar o histórico de pedidos
  update public.products set active = false, available = false where id = p_id and tenant_id = p_tenant;
  perform private.audit(p_tenant, 'gestao', 'product.deleted', 'product', p_id::text, '{}'::jsonb, v_approval);
end $$;

create or replace function public.payment_method_save(
  p_tenant uuid, p_id uuid, p_kind text, p_name text, p_active boolean, p_channels text[], p_position int
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'cadastros.pagamentos.alterar');
  if v_id is null then
    insert into public.payment_methods (tenant_id, kind, name, active, channels, position)
      values (p_tenant, p_kind, trim(p_name), coalesce(p_active, true), coalesce(p_channels, array['caixa', 'atendimento', 'delivery']), coalesce(p_position, 0))
      returning id into v_id;
  else
    update public.payment_methods set kind = p_kind, name = trim(p_name), active = coalesce(p_active, active),
      channels = coalesce(p_channels, channels), position = coalesce(p_position, position)
      where id = v_id and tenant_id = p_tenant;
    if not found then perform private.fail('NOT_FOUND', 'Método não encontrado.'); end if;
  end if;
  perform private.audit(p_tenant, 'gestao', 'payment_method.saved', 'payment_method', v_id::text,
    jsonb_build_object('name', p_name, 'kind', p_kind), v_approval);
  return v_id;
end $$;

create or replace function public.delivery_zone_save(
  p_tenant uuid, p_id uuid, p_name text, p_neighborhoods text[], p_fee_cents bigint,
  p_min_order_cents bigint, p_eta_minutes int, p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'cadastros.taxas.alterar');
  if v_id is null then
    insert into public.delivery_zones (tenant_id, name, neighborhoods, fee_cents, min_order_cents, eta_minutes, active)
      values (p_tenant, trim(p_name), coalesce(p_neighborhoods, '{}'), coalesce(p_fee_cents, 0), coalesce(p_min_order_cents, 0), p_eta_minutes, coalesce(p_active, true))
      returning id into v_id;
  else
    update public.delivery_zones set name = trim(p_name), neighborhoods = coalesce(p_neighborhoods, '{}'),
      fee_cents = coalesce(p_fee_cents, 0), min_order_cents = coalesce(p_min_order_cents, 0),
      eta_minutes = p_eta_minutes, active = coalesce(p_active, active)
      where id = v_id and tenant_id = p_tenant;
    if not found then perform private.fail('NOT_FOUND', 'Região não encontrada.'); end if;
  end if;
  perform private.audit(p_tenant, 'gestao', 'delivery_zone.saved', 'delivery_zone', v_id::text,
    jsonb_build_object('name', p_name, 'fee_cents', p_fee_cents), v_approval);
  return v_id;
end $$;

-- Substitui os horários de funcionamento: [{weekday, opens, closes}]
create or replace function public.business_hours_set(p_tenant uuid, p_hours jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'cadastros.horarios.alterar');
  delete from public.business_hours where tenant_id = p_tenant;
  insert into public.business_hours (tenant_id, weekday, opens, closes)
    select p_tenant, (h ->> 'weekday')::smallint, (h ->> 'opens')::time, (h ->> 'closes')::time
    from jsonb_array_elements(coalesce(p_hours, '[]'::jsonb)) h;
  perform private.audit(p_tenant, 'gestao', 'business_hours.set', 'tenant', p_tenant::text, jsonb_build_object('hours', p_hours), v_approval);
end $$;

create or replace function public.material_save(
  p_tenant uuid, p_id uuid, p_name text, p_category text, p_unit text, p_sku text,
  p_min_qty numeric, p_reorder_qty numeric, p_perishable boolean, p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_approval uuid;
begin
  -- Cadastro compartilhado: suprimentos (Gestão/Administrativo) ou materiais (Estoque)
  if private.evaluate_permission((select auth.uid()), p_tenant, 'estoque.materiais.gerir') = 'direct' then
    v_approval := private.authorize(p_tenant, 'estoque.materiais.gerir');
  else
    v_approval := private.authorize(p_tenant, 'cadastros.suprimentos.alterar');
  end if;
  if v_id is null then
    insert into public.materials (tenant_id, name, category, unit, sku, min_qty, reorder_qty, perishable, active)
      values (p_tenant, trim(p_name), coalesce(nullif(trim(p_category), ''), 'Geral'), coalesce(p_unit, 'un'), p_sku,
        coalesce(p_min_qty, 0), coalesce(p_reorder_qty, 0), coalesce(p_perishable, false), coalesce(p_active, true))
      returning id into v_id;
  else
    update public.materials set name = trim(p_name), category = coalesce(nullif(trim(p_category), ''), category),
      unit = coalesce(p_unit, unit), sku = p_sku, min_qty = coalesce(p_min_qty, min_qty),
      reorder_qty = coalesce(p_reorder_qty, reorder_qty), perishable = coalesce(p_perishable, perishable),
      active = coalesce(p_active, active)
      where id = v_id and tenant_id = p_tenant;
    if not found then perform private.fail('NOT_FOUND', 'Material não encontrado.'); end if;
  end if;
  perform private.audit(p_tenant, 'estoque', 'material.saved', 'material', v_id::text, jsonb_build_object('name', p_name), v_approval);
  return v_id;
end $$;
