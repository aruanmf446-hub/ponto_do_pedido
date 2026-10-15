-- Ponto do Pedido — projeto comercial (assinaturas)
-- Contas de assinantes, planos, assinaturas, contratos, renovação,
-- vencimentos, licenciamento de módulos e cobranças da plataforma.
--
-- Identidade: a autoridade de autenticação é o projeto `pontodopedido`.
-- `accounts.identity_user_id` guarda o id do usuário naquele projeto, validado
-- pela Edge Function `billing` a cada requisição. O navegador nunca escreve
-- aqui diretamente: somente a Edge Function, com a chave secreta do projeto.

create extension if not exists pgcrypto with schema extensions;

create type public.subscription_status as enum ('pending_payment', 'active', 'past_due', 'suspended', 'cancelled');
create type public.invoice_status as enum ('open', 'paid', 'void');

-- Valores comerciais NÃO são definidos pelo sistema: price_cents nulo significa
-- "valor a definir" e é exibido como tal no site. O proprietário da plataforma
-- configura nome, módulos e valores diretamente nesta tabela.
create table public.plans (
  code text primary key check (code ~ '^[a-z0-9_]{2,30}$'),
  name text not null,
  tagline text not null default '',
  description text not null default '',
  modules text[] not null check (modules <@ array['gestao', 'caixa', 'atendimento', 'cozinha', 'cardapio', 'delivery', 'financeiro', 'estoque']),
  price_cents bigint check (price_cents is null or price_cents >= 0),
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'yearly')),
  highlights text[] not null default '{}',
  position int not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.plans (code, name, tagline, description, modules, position, highlights) values
  ('start', 'START', 'Para quem opera o próprio restaurante',
   'O titular atende, produz e recebe pedidos locais e de delivery com poucos colaboradores.',
   array['gestao', 'atendimento', 'cozinha', 'cardapio', 'delivery'], 1,
   array['Gestão do restaurante', 'Atendimento por mesa', 'Cozinha em Kanban', 'Cardápio por QR Code', 'Delivery com link próprio']),
  ('plus', 'PLUS', 'Para equipes com caixa dedicado',
   'Inclui o Caixa transacional com abertura, conferência e fechamento de turno.',
   array['gestao', 'atendimento', 'cozinha', 'cardapio', 'delivery', 'caixa'], 2,
   array['Tudo do START', 'Caixa com conferência e divergências', 'Sangrias, suprimentos e estornos autorizados']),
  ('diamond', 'DIAMOND', 'Para operações completas',
   'Inclui Administrativo e Financeiro e Estoque, com ERP externo opcional por processo.',
   array['gestao', 'atendimento', 'cozinha', 'cardapio', 'delivery', 'caixa', 'financeiro', 'estoque'], 3,
   array['Tudo do PLUS', 'Compras, contas e conciliação', 'Estoque com lotes, validade e inventário']);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
-- Sem gateway de pagamento configurado, a ativação é imediata e a fatura fica
-- registrada como "aberta" para cobrança fora da plataforma. Nenhuma cobrança
-- real é executada pelo sistema.
insert into public.platform_settings (key, value) values
  ('payment_provider', 'null'::jsonb),
  ('activation_mode', '"immediate"'::jsonb),
  ('cancellation_policy', '"end_of_period"'::jsonb),
  ('terms_version', '"2026-10"'::jsonb);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  identity_user_id uuid not null unique,
  email text not null,
  name text not null,
  document text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id),
  plan_code text not null references public.plans (code),
  status public.subscription_status not null default 'pending_payment',
  restaurant_name text not null,
  restaurant_slug text not null unique check (restaurant_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  provisioned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_account_idx on public.subscriptions (account_id);
create index subscriptions_plan_idx on public.subscriptions (plan_code);

create table public.subscription_events (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.subscriptions (id),
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  actor_identity uuid,
  at timestamptz not null default now()
);
create index subscription_events_subscription_idx on public.subscription_events (subscription_id, at desc);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id),
  terms_version text not null,
  plan_code text not null,
  accepted_by uuid not null,
  accepted_at timestamptz not null default now(),
  user_agent text
);
create index contracts_subscription_idx on public.contracts (subscription_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id),
  plan_code text not null,
  amount_cents bigint,
  period_start timestamptz not null,
  period_end timestamptz not null,
  due_date date not null,
  status public.invoice_status not null default 'open',
  provider text,
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index invoices_subscription_idx on public.invoices (subscription_id, period_start desc);

create table public.idempotency (
  key text primary key,
  account_id uuid not null references public.accounts (id),
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index idempotency_account_idx on public.idempotency (account_id);

alter table public.plans enable row level security;
alter table public.platform_settings enable row level security;
alter table public.accounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.contracts enable row level security;
alter table public.invoices enable row level security;
alter table public.idempotency enable row level security;

-- Somente o catálogo de planos ativos é público.
create policy plans_public_read on public.plans for select to anon, authenticated using (active);

revoke all on all tables in schema public from anon, authenticated;
grant select on public.plans to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Operações comerciais transacionais (executadas pela Edge Function com a
-- chave secreta; identidade já validada no projeto pontodopedido)
-- ---------------------------------------------------------------------------
create or replace function public.billing_period_interval(p_plan text)
returns interval language sql stable set search_path = '' as $$
  select case (select billing_period from public.plans where code = p_plan) when 'yearly' then interval '1 year' else interval '1 month' end
$$;

create or replace function public.billing_upsert_account(p_identity uuid, p_email text, p_name text)
returns public.accounts language plpgsql security definer set search_path = '' as $$
declare v public.accounts;
begin
  insert into public.accounts (identity_user_id, email, name)
    values (p_identity, lower(trim(p_email)), coalesce(nullif(trim(p_name), ''), split_part(p_email, '@', 1)))
  on conflict (identity_user_id) do update set email = excluded.email, updated_at = now()
  returning * into v;
  return v;
end $$;

create or replace function public.billing_subscribe(
  p_identity uuid, p_email text, p_name text, p_plan text, p_restaurant_name text, p_slug text,
  p_user_agent text, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_account public.accounts;
  v_plan public.plans;
  v_sub public.subscriptions;
  v_activation text;
  v_terms text;
  v_existing jsonb;
  v_result jsonb;
begin
  v_account := public.billing_upsert_account(p_identity, p_email, p_name);
  select result into v_existing from public.idempotency where key = p_idempotency_key and account_id = v_account.id;
  if found then return v_existing; end if;

  select * into v_plan from public.plans where code = p_plan and active;
  if not found then raise exception using message = 'Plano indisponível.', detail = 'INVALID_PLAN'; end if;
  if char_length(trim(coalesce(p_restaurant_name, ''))) < 2 then
    raise exception using message = 'Informe o nome do restaurante.', detail = 'INVALID';
  end if;
  if exists (select 1 from public.subscriptions where restaurant_slug = lower(trim(p_slug))) then
    raise exception using message = 'Este endereço já está em uso.', detail = 'SLUG_TAKEN';
  end if;

  select value #>> '{}' into v_activation from public.platform_settings where key = 'activation_mode';
  select value #>> '{}' into v_terms from public.platform_settings where key = 'terms_version';

  insert into public.subscriptions (account_id, plan_code, status, restaurant_name, restaurant_slug, current_period_start, current_period_end)
  values (v_account.id, v_plan.code,
    case when v_activation = 'immediate' then 'active' else 'pending_payment' end::public.subscription_status,
    trim(p_restaurant_name), lower(trim(p_slug)),
    case when v_activation = 'immediate' then now() end,
    case when v_activation = 'immediate' then now() + public.billing_period_interval(v_plan.code) end)
  returning * into v_sub;

  insert into public.contracts (subscription_id, terms_version, plan_code, accepted_by, user_agent)
    values (v_sub.id, coalesce(v_terms, 'v1'), v_plan.code, p_identity, left(p_user_agent, 300));
  insert into public.invoices (subscription_id, plan_code, amount_cents, period_start, period_end, due_date)
    values (v_sub.id, v_plan.code, v_plan.price_cents, coalesce(v_sub.current_period_start, now()),
      coalesce(v_sub.current_period_end, now() + public.billing_period_interval(v_plan.code)), current_date);
  insert into public.subscription_events (subscription_id, kind, data, actor_identity)
    values (v_sub.id, 'subscribed', jsonb_build_object('plan', v_plan.code, 'activation', v_activation), p_identity);

  v_result := jsonb_build_object('subscription_id', v_sub.id, 'status', v_sub.status);
  insert into public.idempotency (key, account_id, result) values (p_idempotency_key, v_account.id, v_result);
  return v_result;
end $$;

create or replace function public.billing_lock_subscription(p_identity uuid, p_subscription uuid)
returns public.subscriptions language plpgsql security definer set search_path = '' as $$
declare v public.subscriptions;
begin
  select s.* into v from public.subscriptions s join public.accounts a on a.id = s.account_id
    where s.id = p_subscription and a.identity_user_id = p_identity for update of s;
  if not found then
    raise exception using message = 'Assinatura não encontrada.', detail = 'NOT_FOUND';
  end if;
  return v;
end $$;

create or replace function public.billing_renew(p_identity uuid, p_subscription uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.subscriptions;
  v_start timestamptz;
  v_end timestamptz;
  v_price bigint;
begin
  v := public.billing_lock_subscription(p_identity, p_subscription);
  if v.status = 'cancelled' and v.current_period_end is not null and v.current_period_end < now() - interval '90 days' then
    raise exception using message = 'Assinatura encerrada há mais de 90 dias. Contrate novamente.', detail = 'INVALID_STATE';
  end if;
  v_start := greatest(coalesce(v.current_period_end, now()), now());
  v_end := v_start + public.billing_period_interval(v.plan_code);
  select price_cents into v_price from public.plans where code = v.plan_code;
  update public.subscriptions set status = 'active', current_period_end = v_end,
    current_period_start = coalesce(current_period_start, now()), cancel_at_period_end = false, cancelled_at = null, updated_at = now()
    where id = v.id;
  insert into public.invoices (subscription_id, plan_code, amount_cents, period_start, period_end, due_date)
    values (v.id, v.plan_code, v_price, v_start, v_end, current_date);
  insert into public.subscription_events (subscription_id, kind, data, actor_identity)
    values (v.id, 'renewed', jsonb_build_object('until', v_end), p_identity);
  return jsonb_build_object('subscription_id', v.id, 'current_period_end', v_end);
end $$;

create or replace function public.billing_change_plan(p_identity uuid, p_subscription uuid, p_plan text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.subscriptions;
begin
  v := public.billing_lock_subscription(p_identity, p_subscription);
  if not exists (select 1 from public.plans where code = p_plan and active) then
    raise exception using message = 'Plano indisponível.', detail = 'INVALID_PLAN';
  end if;
  if v.status not in ('active', 'past_due') then
    raise exception using message = 'A assinatura precisa estar ativa para alterar o plano.', detail = 'INVALID_STATE';
  end if;
  if v.plan_code = p_plan then
    return jsonb_build_object('subscription_id', v.id, 'plan_code', p_plan);
  end if;
  update public.subscriptions set plan_code = p_plan, updated_at = now() where id = v.id;
  insert into public.contracts (subscription_id, terms_version, plan_code, accepted_by)
    values (v.id, coalesce((select value #>> '{}' from public.platform_settings where key = 'terms_version'), 'v1'), p_plan, p_identity);
  insert into public.subscription_events (subscription_id, kind, data, actor_identity)
    values (v.id, 'plan_changed', jsonb_build_object('from', v.plan_code, 'to', p_plan), p_identity);
  return jsonb_build_object('subscription_id', v.id, 'plan_code', p_plan);
end $$;

-- Cancelamento ao fim do período vigente (política padrão), reversível até lá.
create or replace function public.billing_cancel(p_identity uuid, p_subscription uuid, p_undo boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.subscriptions;
begin
  v := public.billing_lock_subscription(p_identity, p_subscription);
  if p_undo then
    if v.status <> 'active' or not v.cancel_at_period_end then
      raise exception using message = 'Não há cancelamento agendado.', detail = 'INVALID_STATE';
    end if;
    update public.subscriptions set cancel_at_period_end = false, updated_at = now() where id = v.id;
    insert into public.subscription_events (subscription_id, kind, actor_identity) values (v.id, 'cancel_undone', p_identity);
  else
    if v.status not in ('active', 'past_due', 'pending_payment') then
      raise exception using message = 'A assinatura não está ativa.', detail = 'INVALID_STATE';
    end if;
    update public.subscriptions set cancel_at_period_end = true, cancelled_at = now(),
      status = case when v.status = 'pending_payment' then 'cancelled' else v.status end, updated_at = now()
      where id = v.id;
    insert into public.subscription_events (subscription_id, kind, data, actor_identity)
      values (v.id, 'cancel_scheduled', jsonb_build_object('effective_at', v.current_period_end), p_identity);
  end if;
  return jsonb_build_object('subscription_id', v.id);
end $$;

-- Encerra assinaturas canceladas cujo período terminou (idempotente; chamada em toda leitura).
create or replace function public.billing_settle_expired()
returns void language sql security definer set search_path = '' as $$
  update public.subscriptions set status = 'cancelled', updated_at = now()
  where cancel_at_period_end and status in ('active', 'past_due') and current_period_end <= now();
$$;

-- Situação comercial completa do titular.
create or replace function public.billing_overview(p_identity uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'account', (select to_jsonb(a) - 'identity_user_id' from public.accounts a where a.identity_user_id = p_identity),
    'payment_provider', (select value from public.platform_settings where key = 'payment_provider'),
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'plan_code', s.plan_code, 'plan_name', p.name, 'modules', p.modules, 'price_cents', p.price_cents,
        'billing_period', p.billing_period, 'status', s.status, 'restaurant_name', s.restaurant_name,
        'restaurant_slug', s.restaurant_slug, 'current_period_start', s.current_period_start,
        'current_period_end', s.current_period_end, 'cancel_at_period_end', s.cancel_at_period_end,
        'created_at', s.created_at,
        'invoices', (select coalesce(jsonb_agg(to_jsonb(i) order by i.period_start desc), '[]'::jsonb)
                     from (select * from public.invoices where subscription_id = s.id order by period_start desc limit 12) i)
      ) order by s.created_at)
      from public.subscriptions s join public.accounts a on a.id = s.account_id join public.plans p on p.code = s.plan_code
      where a.identity_user_id = p_identity), '[]'::jsonb)
  )
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
