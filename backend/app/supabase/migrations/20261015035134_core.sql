-- Ponto do Pedido — projeto operacional (pontodopedido)
-- Núcleo: estabelecimentos, licenças, identidade, permissões, delegações,
-- aprovações, auditoria e preferências visuais.
--
-- Regras:
-- * Toda tabela em `public` tem RLS habilitado.
-- * O navegador só lê via RLS. Escritas acontecem por funções RPC que
--   validam usuário, estabelecimento, módulo contratado, permissão e limites.
-- * Funções auxiliares privilegiadas ficam no schema `private` (não exposto).

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.app_module as enum (
  'gestao', 'caixa', 'atendimento', 'cozinha', 'cardapio', 'delivery', 'financeiro', 'estoque'
);

create type public.tenant_status as enum ('pending', 'active', 'suspended', 'cancelled');
create type public.membership_status as enum ('active', 'suspended', 'revoked');
create type public.grant_mode as enum ('direct', 'approval', 'deny');
create type public.approval_status as enum ('pending', 'approved', 'rejected', 'executed', 'cancelled', 'failed');
create type public.ui_scheme as enum ('light', 'dark', 'system');

-- ---------------------------------------------------------------------------
-- Estabelecimentos e licenças (licenças são gravadas somente pela função de
-- sincronização com o projeto `assinaturas`, usando service_role)
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  name text not null check (char_length(name) between 2 and 120),
  legal_name text,
  document text,
  phone text,
  email text,
  address jsonb not null default '{}'::jsonb,
  logo_path text,
  timezone text not null default 'America/Sao_Paulo',
  business_day_start_hour smallint not null default 4 check (business_day_start_hour between 0 and 12),
  owner_user_id uuid not null references auth.users (id),
  status public.tenant_status not null default 'pending',
  plan_code text,
  license_valid_until timestamptz,
  billing_subscription_id uuid unique,
  settings jsonb not null default '{}'::jsonb,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tenants_owner_idx on public.tenants (owner_user_id);

create table public.tenant_modules (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  module public.app_module not null,
  primary key (tenant_id, module)
);

-- Slugs reservados para subdomínios de sistema
create table private.reserved_slugs (slug text primary key);
insert into private.reserved_slugs (slug) values
  ('www'), ('app'), ('api'), ('portal'), ('admin'), ('mail'), ('static'), ('cdn'),
  ('suporte'), ('ajuda'), ('status'), ('blog'), ('assets'), ('auth'), ('login');

-- ---------------------------------------------------------------------------
-- Identidade
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  job_title text,
  is_owner boolean not null default false,
  status public.membership_status not null default 'active',
  primary_app public.app_module,
  supervisor_membership_id uuid references public.memberships (id),
  must_change_password boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);
create index memberships_supervisor_idx on public.memberships (supervisor_membership_id);
create unique index memberships_one_owner on public.memberships (tenant_id) where is_owner;

-- ---------------------------------------------------------------------------
-- Catálogo de permissões
-- ---------------------------------------------------------------------------
create table public.permissions (
  code text primary key,
  module public.app_module not null,
  label text not null,
  description text not null default '',
  action text not null check (action in ('acessar', 'visualizar', 'cadastrar', 'alterar', 'excluir', 'executar', 'aprovar', 'delegar')),
  supports_limit boolean not null default false,
  approvable boolean not null default false
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '',
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  permission_code text not null references public.permissions (code),
  mode public.grant_mode not null default 'direct' check (mode <> 'deny'),
  limit_cents bigint check (limit_cents is null or limit_cents >= 0),
  can_delegate boolean not null default false,
  primary key (role_id, permission_code)
);
create index role_permissions_tenant_idx on public.role_permissions (tenant_id);
create index role_permissions_permission_idx on public.role_permissions (permission_code);

create table public.membership_roles (
  membership_id uuid not null references public.memberships (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  assigned_by uuid references auth.users (id),
  assigned_at timestamptz not null default now(),
  primary key (membership_id, role_id)
);
create index membership_roles_role_idx on public.membership_roles (role_id);
create index membership_roles_tenant_idx on public.membership_roles (tenant_id);

create table public.member_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  permission_code text not null references public.permissions (code),
  mode public.grant_mode not null default 'direct',
  limit_cents bigint check (limit_cents is null or limit_cents >= 0),
  can_delegate boolean not null default false,
  expires_at timestamptz,
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id)
);
create unique index member_permissions_active_uq
  on public.member_permissions (membership_id, permission_code) where revoked_at is null;
create index member_permissions_tenant_idx on public.member_permissions (tenant_id);
create index member_permissions_permission_idx on public.member_permissions (permission_code);

-- ---------------------------------------------------------------------------
-- Aprovações e auditoria
-- ---------------------------------------------------------------------------
create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  module public.app_module not null,
  permission_code text not null references public.permissions (code),
  action_kind text not null,
  summary text not null,
  amount_cents bigint,
  payload jsonb not null default '{}'::jsonb,
  reason text,
  requested_by uuid not null references auth.users (id),
  requested_at timestamptz not null default now(),
  status public.approval_status not null default 'pending',
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  decision_note text,
  executed_at timestamptz,
  result jsonb,
  error text,
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index approval_requests_tenant_status_idx on public.approval_requests (tenant_id, status, requested_at desc);
create index approval_requests_requested_by_idx on public.approval_requests (requested_by);
create index approval_requests_decided_by_idx on public.approval_requests (decided_by);
create index approval_requests_permission_idx on public.approval_requests (permission_code);

create table public.audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  at timestamptz not null default now(),
  actor_user_id uuid references auth.users (id),
  module public.app_module,
  action text not null,
  entity text,
  entity_id text,
  approval_id uuid references public.approval_requests (id),
  data jsonb not null default '{}'::jsonb
);
create index audit_log_tenant_at_idx on public.audit_log (tenant_id, at desc);
create index audit_log_actor_idx on public.audit_log (actor_user_id);
create index audit_log_approval_idx on public.audit_log (approval_id);

-- ---------------------------------------------------------------------------
-- Preferências visuais por usuário, estabelecimento e aplicativo
-- ---------------------------------------------------------------------------
create table public.ui_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  app public.app_module not null,
  model text not null check (model in ('m1', 'm2', 'm3', 'm4')),
  scheme public.ui_scheme not null default 'system',
  updated_at timestamptz not null default now(),
  primary key (user_id, tenant_id, app)
);
create index ui_preferences_tenant_idx on public.ui_preferences (tenant_id);

-- ---------------------------------------------------------------------------
-- Responsabilidade por processo (controle interno x ERP externo).
-- Não é integração técnica: apenas define quem controla cada processo.
-- ---------------------------------------------------------------------------
create table public.process_ownership (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  process text not null check (process in (
    'estoque', 'compras', 'fornecedores', 'contas_pagar', 'contas_receber',
    'conciliacao', 'orcamentos', 'documentos', 'reembolsos'
  )),
  owner text not null default 'interno' check (owner in ('interno', 'externo')),
  external_system text,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, process)
);

-- ---------------------------------------------------------------------------
-- Primeiro acesso
-- ---------------------------------------------------------------------------
create table public.onboarding_steps (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  step text not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, step)
);

-- ---------------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger tenants_touch before update on public.tenants
  for each row execute function private.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger memberships_touch before update on public.memberships
  for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Erro padronizado para a interface: código em DETAIL + mensagem em português.
create or replace function private.fail(code text, message text)
returns void language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = message, detail = code;
end $$;

-- Estabelecimento operacional: ativo e com licença vigente.
create or replace function private.tenant_operational(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenants t
    where t.id = p_tenant and t.status = 'active'
      and (t.license_valid_until is null or t.license_valid_until > now())
  )
$$;

create or replace function private.module_enabled(p_tenant uuid, p_module public.app_module)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_module = 'gestao' or exists (
    select 1 from public.tenant_modules tm where tm.tenant_id = p_tenant and tm.module = p_module
  )
$$;

-- Usuário pertence ao estabelecimento (qualquer função) — base das políticas de leitura.
create or replace function private.is_member(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant and m.user_id = (select auth.uid()) and m.status = 'active'
  )
$$;

create or replace function private.is_owner(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenants t where t.id = p_tenant and t.owner_user_id = (select auth.uid())
  )
$$;

-- Avaliação de uma permissão para um usuário (usada também ao revalidar
-- o aprovador). Retorna 'direct' | 'approval' | 'deny'.
create or replace function private.evaluate_permission(
  p_user uuid, p_tenant uuid, p_permission text, p_amount bigint default null
) returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_perm public.permissions;
  v_member public.memberships;
  v_has_direct_within boolean := false;
  v_has_any boolean := false;
begin
  if p_user is null then
    return 'deny';
  end if;
  select * into v_perm from public.permissions where code = p_permission;
  if not found then
    return 'deny';
  end if;
  if not private.tenant_operational(p_tenant) or not private.module_enabled(p_tenant, v_perm.module) then
    return 'deny';
  end if;
  select * into v_member from public.memberships
    where tenant_id = p_tenant and user_id = p_user and status = 'active';
  if not found then
    return 'deny';
  end if;
  if v_member.is_owner then
    return 'direct';
  end if;
  -- Negação explícita prevalece sobre funções
  if exists (
    select 1 from public.member_permissions mp
    where mp.membership_id = v_member.id and mp.permission_code = p_permission
      and mp.revoked_at is null and (mp.expires_at is null or mp.expires_at > now())
      and mp.mode = 'deny'
  ) then
    return 'deny';
  end if;

  with grants as (
    select mp.mode, mp.limit_cents from public.member_permissions mp
    where mp.membership_id = v_member.id and mp.permission_code = p_permission
      and mp.revoked_at is null and (mp.expires_at is null or mp.expires_at > now())
    union all
    select rp.mode, rp.limit_cents from public.membership_roles mr
    join public.role_permissions rp on rp.role_id = mr.role_id
    where mr.membership_id = v_member.id and rp.permission_code = p_permission
  )
  select
    coalesce(bool_or(g.mode = 'direct' and (g.limit_cents is null or p_amount is null or p_amount <= g.limit_cents)), false),
    count(*) > 0
  into v_has_direct_within, v_has_any
  from grants g;

  if v_has_direct_within then
    return 'direct';
  end if;
  if v_has_any and v_perm.approvable then
    return 'approval';
  end if;
  return 'deny';
end $$;

-- Pode delegar a permissão (titular, ou concessão com can_delegate + permissão de delegar).
create or replace function private.can_delegate(p_user uuid, p_tenant uuid, p_permission text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_member public.memberships;
begin
  select * into v_member from public.memberships
    where tenant_id = p_tenant and user_id = p_user and status = 'active';
  if not found then
    return false;
  end if;
  if v_member.is_owner then
    return true;
  end if;
  if private.evaluate_permission(p_user, p_tenant, 'gestao.permissoes.delegar') <> 'direct' then
    return false;
  end if;
  return exists (
    select 1 from public.member_permissions mp
    where mp.membership_id = v_member.id and mp.permission_code = p_permission and mp.mode = 'direct'
      and mp.can_delegate and mp.revoked_at is null and (mp.expires_at is null or mp.expires_at > now())
    union all
    select 1 from public.membership_roles mr
    join public.role_permissions rp on rp.role_id = mr.role_id
    where mr.membership_id = v_member.id and rp.permission_code = p_permission and rp.mode = 'direct' and rp.can_delegate
  );
end $$;

-- Maior limite direto do usuário (null = ilimitado; -1 = nenhum).
create or replace function private.direct_limit(p_user uuid, p_tenant uuid, p_permission text)
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare
  v_member public.memberships;
  v_unlimited boolean;
  v_max bigint;
  v_count int;
begin
  select * into v_member from public.memberships
    where tenant_id = p_tenant and user_id = p_user and status = 'active';
  if not found then
    return -1;
  end if;
  if v_member.is_owner then
    return null;
  end if;
  with grants as (
    select mp.limit_cents from public.member_permissions mp
    where mp.membership_id = v_member.id and mp.permission_code = p_permission and mp.mode = 'direct'
      and mp.revoked_at is null and (mp.expires_at is null or mp.expires_at > now())
    union all
    select rp.limit_cents from public.membership_roles mr
    join public.role_permissions rp on rp.role_id = mr.role_id
    where mr.membership_id = v_member.id and rp.permission_code = p_permission and rp.mode = 'direct'
  )
  select coalesce(bool_or(limit_cents is null), false), max(limit_cents), count(*)
    into v_unlimited, v_max, v_count
  from grants;
  if v_count = 0 then
    return -1;
  end if;
  if v_unlimited then
    return null;
  end if;
  return v_max;
end $$;

create or replace function private.audit(
  p_tenant uuid, p_module public.app_module, p_action text, p_entity text, p_entity_id text,
  p_data jsonb default '{}'::jsonb, p_approval uuid default null
) returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (tenant_id, actor_user_id, module, action, entity, entity_id, data, approval_id)
  values (p_tenant, (select auth.uid()), p_module, p_action, p_entity, p_entity_id, coalesce(p_data, '{}'::jsonb),
    coalesce(p_approval, nullif(current_setting('pdp.approval_id', true), '')::uuid));
$$;

-- Validação universal. Retorna o id da aprovação usada (ou null se direta).
-- Lança APPROVAL_REQUIRED quando a ação pode ser solicitada a um responsável,
-- FORBIDDEN quando bloqueada.
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

  -- Execução de aprovação pontual (definida apenas pelo despachante)
  v_approval_id := nullif(current_setting('pdp.approval_id', true), '')::uuid;
  if v_approval_id is not null then
    select * into v_req from public.approval_requests where id = v_approval_id;
    if found and v_req.tenant_id = p_tenant and v_req.permission_code = p_permission
       and v_req.status = 'approved' and v_req.executed_at is null
       and (p_amount is null or v_req.amount_cents is null or p_amount <= v_req.amount_cents) then
      if private.evaluate_permission(v_req.decided_by, p_tenant, p_permission, p_amount) = 'direct' then
        return v_approval_id;
      end if;
      perform private.fail('APPROVER_REVOKED', 'O responsável que aprovou não possui mais autoridade para esta ação.');
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

-- Verificação somente de leitura para telas (sem lançar erro).
create or replace function public.check_permission(p_tenant uuid, p_permission text, p_amount bigint default null)
returns text language sql stable security definer set search_path = '' as $$
  select private.evaluate_permission((select auth.uid()), p_tenant, p_permission, p_amount)
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member(uuid), private.is_owner(uuid),
  private.tenant_operational(uuid), private.module_enabled(uuid, public.app_module),
  private.evaluate_permission(uuid, uuid, text, bigint)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — leitura por membros, escrita via RPC
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.tenant_modules enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.membership_roles enable row level security;
alter table public.member_permissions enable row level security;
alter table public.approval_requests enable row level security;
alter table public.audit_log enable row level security;
alter table public.ui_preferences enable row level security;
alter table public.process_ownership enable row level security;
alter table public.onboarding_steps enable row level security;

create policy tenants_select on public.tenants for select to authenticated
  using ((select private.is_member(id)) or owner_user_id = (select auth.uid()));
create policy tenant_modules_select on public.tenant_modules for select to authenticated
  using ((select private.is_member(tenant_id)));
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.memberships me
    join public.memberships other on other.tenant_id = me.tenant_id
    where me.user_id = (select auth.uid()) and me.status = 'active' and other.user_id = profiles.user_id
  ));
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_member(tenant_id)));
create policy permissions_select on public.permissions for select to authenticated using (true);
create policy roles_select on public.roles for select to authenticated
  using ((select private.is_member(tenant_id)));
create policy role_permissions_select on public.role_permissions for select to authenticated
  using ((select private.is_member(tenant_id)));
create policy membership_roles_select on public.membership_roles for select to authenticated
  using ((select private.is_member(tenant_id)));
create policy member_permissions_select on public.member_permissions for select to authenticated
  using ((select private.is_member(tenant_id)));
create policy approval_requests_select on public.approval_requests for select to authenticated
  using ((select private.is_member(tenant_id)));
create policy audit_log_select on public.audit_log for select to authenticated
  using ((select private.is_owner(tenant_id))
    or private.evaluate_permission((select auth.uid()), tenant_id, 'gestao.historico.visualizar') = 'direct');
create policy ui_preferences_select on public.ui_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy ui_preferences_insert on public.ui_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_member(tenant_id)));
create policy ui_preferences_update on public.ui_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select private.is_member(tenant_id)));
create policy process_ownership_select on public.process_ownership for select to authenticated
  using ((select private.is_member(tenant_id)));
create policy onboarding_steps_select on public.onboarding_steps for select to authenticated
  using ((select private.is_member(tenant_id)));
