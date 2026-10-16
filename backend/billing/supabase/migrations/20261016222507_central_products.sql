-- PREPARADA: implantação coordenada com as funções; não habilita pagamentos.
-- Billing CRM PLUS: cada identidade pertence ao Auth autorizado de um produto.
create table public.products (
  id text primary key check (id ~ '^[a-z0-9_]{2,50}$'),
  name text not null,
  auth_url text not null unique check (auth_url ~ '^https://[a-z0-9]{20}\.supabase\.co$'),
  auth_publishable_key text not null check (length(auth_publishable_key) > 20),
  allowed_return_urls text[] not null default '{}',
  payment_return_url text,
  slug_check_rpc text check (slug_check_rpc is null or slug_check_rpc = 'slug_available'),
  active boolean not null default true,
  terms_version text not null default '2026-10',
  check (payment_return_url is null or payment_return_url = any(allowed_return_urls))
);
alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
grant all on public.products to service_role;
insert into public.products (id,name,auth_url,auth_publishable_key,allowed_return_urls,payment_return_url,slug_check_rpc)
values ('ponto_do_pedido','Ponto do Pedido','https://qmhtzosfbosgolevnybd.supabase.co',
  'sb_publishable_sapC0VZk-WmhVx__PB65HQ_N7s0dX_d',
  array['https://pontodopedido.vercel.app/portal'],'https://pontodopedido.vercel.app/portal','slug_available');

-- Contexto exclusivo de uma transação/RPC, estabelecido somente pelo gateway de serviço.
-- Chamadas legadas continuam limitadas ao Ponto do Pedido.
create function public.billing_current_product() returns text language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('billing.product_id', true), ''), 'ponto_do_pedido')
$$;
alter table public.plans add column product_id text not null default public.billing_current_product() references public.products(id);
alter table public.accounts add column product_id text not null default public.billing_current_product() references public.products(id);
alter table public.subscriptions add column product_id text not null default public.billing_current_product() references public.products(id);
alter table public.contracts add column product_id text not null default public.billing_current_product() references public.products(id);
alter table public.invoices add column product_id text not null default public.billing_current_product() references public.products(id);
alter table public.subscription_events add column product_id text not null default public.billing_current_product() references public.products(id);
alter table public.idempotency add column product_id text not null default public.billing_current_product() references public.products(id);
alter table public.payment_events add column product_id text references public.products(id);
-- Eventos históricos sem associação inequívoca permanecem sem produto.
update public.payment_events e set product_id = s.product_id from public.subscriptions s
where (e.kind = 'preapproval' and e.payload ->> 'external_reference' = s.id::text)
   or (e.kind = 'authorized_payment' and e.payload ->> 'preapproval_id' = s.provider_subscription_id);

alter table public.subscriptions drop constraint subscriptions_plan_code_fkey;
alter table public.plans drop constraint plans_pkey;
alter table public.plans add primary key (product_id, code);
alter table public.plans drop constraint plans_modules_check;
alter table public.accounts drop constraint accounts_identity_user_id_key;
alter table public.accounts add unique (product_id, identity_user_id);
alter table public.accounts add unique (product_id, id);
alter table public.subscriptions drop constraint subscriptions_restaurant_slug_key;
alter table public.subscriptions add unique (product_id, restaurant_slug);
alter table public.subscriptions add unique (product_id, id);
alter table public.subscriptions add foreign key (product_id, account_id) references public.accounts(product_id,id);
alter table public.subscriptions add foreign key (product_id, plan_code) references public.plans(product_id,code);
alter table public.idempotency drop constraint idempotency_pkey;
alter table public.idempotency add primary key (product_id,key);
alter table public.idempotency add foreign key (product_id,account_id) references public.accounts(product_id,id);
alter table public.contracts add foreign key (product_id,subscription_id) references public.subscriptions(product_id,id);
alter table public.invoices add foreign key (product_id,subscription_id) references public.subscriptions(product_id,id);
alter table public.subscription_events add foreign key (product_id,subscription_id) references public.subscriptions(product_id,id);
alter table public.contracts add foreign key (product_id,plan_code) references public.plans(product_id,code);
alter table public.invoices add foreign key (product_id,plan_code) references public.plans(product_id,code);

create function public.billing_product_config(p_product text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(p) from public.products p where id = p_product and active
$$;

create or replace function public.billing_period_interval(p_plan text)
returns interval language sql stable set search_path = '' as $$
  select case (select billing_period from public.plans where product_id = public.billing_current_product() and code = p_plan) when 'yearly' then interval '1 year' else interval '1 month' end
$$;

create or replace function public.billing_upsert_account(p_identity uuid, p_email text, p_name text)
returns public.accounts language plpgsql security definer set search_path = '' as $$
declare v public.accounts;
begin
  insert into public.accounts (identity_user_id, email, name)
    values (p_identity, lower(trim(p_email)), coalesce(nullif(trim(p_name), ''), split_part(p_email, '@', 1)))
  on conflict (product_id, identity_user_id) do update set email = excluded.email, updated_at = now()
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
  v_terms text;
  v_existing jsonb;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(public.billing_current_product() || ':' || p_identity::text || ':' || p_idempotency_key, 0));
  v_account := public.billing_upsert_account(p_identity, p_email, p_name);
  select result into v_existing from public.idempotency where product_id = public.billing_current_product() and key = p_idempotency_key and account_id = v_account.id;
  if found then
    select * into v_sub from public.subscriptions
      where id = (v_existing ->> 'subscription_id')::uuid and account_id = v_account.id;
    return jsonb_build_object('subscription_id', v_sub.id, 'status', v_sub.status);
  end if;

  select * into v_plan from public.plans where product_id = public.billing_current_product() and code = p_plan and active;
  if not found then raise exception using message = 'Plano indisponível.', detail = 'INVALID_PLAN'; end if;
  if char_length(trim(coalesce(p_restaurant_name, ''))) < 2 then
    raise exception using message = 'Informe o nome do restaurante.', detail = 'INVALID';
  end if;
  if exists (select 1 from public.subscriptions where product_id = public.billing_current_product() and restaurant_slug = lower(trim(p_slug))) then
    raise exception using message = 'Este endereço já está em uso.', detail = 'SLUG_TAKEN';
  end if;

  -- O cadastro nunca comprova pagamento, independentemente do provedor e modo legado.
  select terms_version into v_terms from public.products where id = public.billing_current_product();

  insert into public.subscriptions (account_id, plan_code, status, restaurant_name, restaurant_slug, current_period_start, current_period_end)
  values (v_account.id, v_plan.code,
    'pending_payment'::public.subscription_status,
    trim(p_restaurant_name), lower(trim(p_slug)),
    null, null)
  returning * into v_sub;

  insert into public.contracts (subscription_id, terms_version, plan_code, accepted_by, user_agent)
    values (v_sub.id, coalesce(v_terms, 'v1'), v_plan.code, p_identity, left(p_user_agent, 300));
  insert into public.invoices (subscription_id, plan_code, amount_cents, period_start, period_end, due_date)
    values (v_sub.id, v_plan.code, v_plan.price_cents, coalesce(v_sub.current_period_start, now()),
      coalesce(v_sub.current_period_end, now() + public.billing_period_interval(v_plan.code)), current_date);
  insert into public.subscription_events (subscription_id, kind, data, actor_identity)
    values (v_sub.id, 'subscribed', jsonb_build_object('plan', v_plan.code, 'activation', 'on_payment'), p_identity);

  v_result := jsonb_build_object('subscription_id', v_sub.id, 'status', v_sub.status);
  insert into public.idempotency (key, account_id, result) values (p_idempotency_key, v_account.id, v_result);
  return v_result;
end $$;

create or replace function public.billing_lock_subscription(p_identity uuid, p_subscription uuid)
returns public.subscriptions language plpgsql security definer set search_path = '' as $$
declare v public.subscriptions;
begin
  select s.* into v from public.subscriptions s join public.accounts a on a.id = s.account_id
    where s.id = p_subscription and a.identity_user_id = p_identity and a.product_id = public.billing_current_product() for update of s;
  if not found then
    raise exception using message = 'Assinatura não encontrada.', detail = 'NOT_FOUND';
  end if;
  return v;
end $$;

create or replace function public.billing_overview(p_identity uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'product_id', public.billing_current_product(),
    'account', (select to_jsonb(a) - 'identity_user_id' from public.accounts a where a.identity_user_id = p_identity and a.product_id = public.billing_current_product()),
    'payment_provider', (select value from public.platform_settings where key = 'payment_provider'),
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'product_id', s.product_id, 'plan_code', s.plan_code, 'plan_name', p.name, 'modules', p.modules, 'price_cents', p.price_cents,
        'billing_period', p.billing_period, 'status', s.status, 'resource_name', s.restaurant_name,
        'resource_slug', s.restaurant_slug, 'restaurant_name', s.restaurant_name,
        'restaurant_slug', s.restaurant_slug, 'current_period_start', s.current_period_start,
        'current_period_end', s.current_period_end, 'cancel_at_period_end', s.cancel_at_period_end,
        'created_at', s.created_at, 'provider_status', s.provider_status, 'next_payment_at', s.next_payment_at,
        'payment_url', s.provider_checkout_url,
        'invoices', (select coalesce(jsonb_agg(to_jsonb(i) order by i.period_start desc), '[]'::jsonb)
                     from (select * from public.invoices where subscription_id = s.id order by period_start desc limit 12) i)
      ) order by s.created_at)
      from public.subscriptions s join public.accounts a on a.id = s.account_id join public.plans p on p.code = s.plan_code and p.product_id = s.product_id
      where a.identity_user_id = p_identity and a.product_id = public.billing_current_product()), '[]'::jsonb)
  )
$$;

create or replace function public.billing_subscription_result(p_identity uuid, p_idempotency_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('subscription_id', s.id, 'status', s.status)
  from public.idempotency i join public.accounts a on a.id = i.account_id
    join public.subscriptions s on s.id = (i.result ->> 'subscription_id')::uuid and s.account_id = a.id
  where a.identity_user_id = p_identity and a.product_id = public.billing_current_product() and i.key = p_idempotency_key
$$;

create or replace function public.billing_payment_context(p_identity uuid, p_subscription uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.subscriptions;
  v_plan public.plans;
  v_account public.accounts;
begin
  if public.billing_payment_provider() is distinct from 'mercadopago' then
    raise exception using message = 'O pagamento online ainda não está habilitado.', detail = 'PAYMENT_DISABLED';
  end if;
  v := public.billing_lock_subscription(p_identity, p_subscription);
  if v.status not in ('pending_payment', 'past_due') then
    raise exception using message = 'Esta assinatura não tem pagamento pendente.', detail = 'INVALID_STATE';
  end if;
  select * into v_plan from public.plans where product_id = v.product_id and code = v.plan_code;
  if v_plan.price_cents is null or v_plan.price_cents <= 0 then
    raise exception using message = 'O valor do plano ainda não foi definido.', detail = 'PRICE_UNDEFINED';
  end if;
  select * into v_account from public.accounts where id = v.account_id;
  return jsonb_build_object(
    'subscription_id', v.id, 'plan_name', v_plan.name, 'amount_cents', v_plan.price_cents,
    'billing_period', v_plan.billing_period, 'restaurant_name', v.restaurant_name,
    'payer_email', v_account.email, 'checkout_url', v.provider_checkout_url
  );
end $$;

create or replace function public.billing_payment_started(p_subscription uuid, p_provider_subscription_id text, p_checkout_url text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.subscriptions
     set provider = 'mercadopago', provider_subscription_id = p_provider_subscription_id,
         provider_checkout_url = p_checkout_url, provider_status = 'pending', updated_at = now()
   where id = p_subscription and product_id = public.billing_current_product();
  if not found then raise exception using message = 'Assinatura não encontrada.', detail = 'NOT_FOUND'; end if;
  insert into public.subscription_events (subscription_id, kind, data)
    values (p_subscription, 'payment_started', jsonb_build_object('provider', 'mercadopago'));
end $$;

create or replace function public.billing_apply_mercadopago(p_event_key text, p_kind text, p_resource jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.subscriptions;
  v_status text;
  v_pay_status text;
  v_pay_id text;
  v_amount bigint;
  v_start timestamptz;
  v_end timestamptz;
  v_invoice uuid;
  v_plan_amount bigint;
begin
  insert into public.payment_events (provider, event_key, kind, resource_id, payload)
    values ('mercadopago', p_event_key, p_kind, p_resource ->> 'id', p_resource)
  on conflict (provider, event_key) do nothing;
  if not found then
    return jsonb_build_object('duplicate', true);
  end if;

  if p_kind = 'preapproval' then
    begin
      select * into v_sub from public.subscriptions where id = (p_resource ->> 'external_reference')::uuid for update;
    exception when invalid_text_representation then
      v_sub := null;
    end;
  else
    select * into v_sub from public.subscriptions
      where provider = 'mercadopago' and provider_subscription_id = p_resource ->> 'preapproval_id' for update;
  end if;
  if v_sub.id is null then
    update public.payment_events set error = 'Assinatura não encontrada.' where provider = 'mercadopago' and event_key = p_event_key;
    return jsonb_build_object('ignored', true);
  end if;

  -- O webhook único resolve o produto pela assinatura registrada, nunca pelo navegador.
  perform set_config('billing.product_id', v_sub.product_id, true);
  update public.payment_events set product_id = v_sub.product_id where provider = 'mercadopago' and event_key = p_event_key;

  -- O provedor pode enviar notificações atrasadas ou de um contrato diferente.
  -- Nunca associar um ID externo que não corresponde ao contrato registrado.
  if p_kind = 'preapproval' and (
    nullif(p_resource ->> 'id', '') is null
    or (v_sub.provider_subscription_id is not null and v_sub.provider_subscription_id <> p_resource ->> 'id')
  ) then
    update public.payment_events set error = 'Identificador do contrato incompatível.'
      where provider = 'mercadopago' and event_key = p_event_key;
    return jsonb_build_object('ignored', true);
  end if;

  if p_kind = 'preapproval' then
    v_status := p_resource ->> 'status';
    update public.subscriptions
       set provider = 'mercadopago', provider_subscription_id = p_resource ->> 'id', provider_status = v_status,
           next_payment_at = nullif(p_resource ->> 'next_payment_date', '')::timestamptz, updated_at = now()
     where id = v_sub.id;
    if v_status = 'cancelled' then
      if v_sub.status = 'pending_payment' then
        update public.subscriptions set status = 'cancelled', cancelled_at = now() where id = v_sub.id;
      elsif v_sub.status in ('active', 'past_due') and not v_sub.cancel_at_period_end then
        update public.subscriptions set cancel_at_period_end = true, cancelled_at = now() where id = v_sub.id;
      end if;
    elsif v_status = 'paused' and v_sub.status = 'active' then
      update public.subscriptions set status = 'past_due' where id = v_sub.id;
    end if;
    insert into public.subscription_events (subscription_id, kind, data)
      values (v_sub.id, 'provider_' || coalesce(v_status, 'unknown'), jsonb_build_object('provider', 'mercadopago'));
    return jsonb_build_object('subscription_id', v_sub.id, 'provider_status', v_status);
  end if;

  -- Cobrança (authorized_payment)
  v_pay_status := p_resource #>> '{payment,status}';
  v_pay_id := p_resource #>> '{payment,id}';

  -- Autorizar acesso somente com cobrança aprovada, na moeda e valor do plano.
  -- O payload já foi consultado diretamente na API do Mercado Pago pelo webhook.
  -- Não usar os dados de uma cobrança incompatível para ativar ou estender licença.
  if v_pay_status = 'approved' then
    select price_cents into v_plan_amount from public.plans where product_id = v_sub.product_id and code = v_sub.plan_code;
    if (p_resource ->> 'currency_id') is distinct from 'BRL'
      or v_plan_amount is null or v_plan_amount <= 0
      or (p_resource ->> 'transaction_amount') is null
      or round(((p_resource ->> 'transaction_amount')::numeric) * 100)::bigint <> v_plan_amount
    then
      update public.payment_events set error = 'Moeda ou valor incompatível com o plano.'
        where provider = 'mercadopago' and event_key = p_event_key;
      return jsonb_build_object('ignored', true, 'reason', 'PAYMENT_AMOUNT_MISMATCH');
    end if;
  end if;

  v_amount := round(coalesce((p_resource ->> 'transaction_amount')::numeric, 0) * 100)::bigint;

  if v_pay_status = 'approved' and v_pay_id is not null then
    if exists (select 1 from public.invoices where provider = 'mercadopago' and provider_reference = v_pay_id) then
      return jsonb_build_object('duplicate', true);
    end if;
    if v_sub.status = 'pending_payment' or v_sub.current_period_end is null or v_sub.current_period_end < now() then
      v_start := now();
    else
      v_start := v_sub.current_period_end;
    end if;
    v_end := v_start + public.billing_period_interval(v_sub.plan_code);

    select id into v_invoice from public.invoices
      where subscription_id = v_sub.id and status = 'open' and provider is null order by created_at limit 1 for update;
    if v_invoice is null then
      insert into public.invoices (subscription_id, plan_code, amount_cents, period_start, period_end, due_date, status, provider, provider_reference, paid_at)
        values (v_sub.id, v_sub.plan_code, v_amount, v_start, v_end, current_date, 'paid', 'mercadopago', v_pay_id, now());
    else
      update public.invoices set amount_cents = v_amount, period_start = v_start, period_end = v_end, status = 'paid',
        provider = 'mercadopago', provider_reference = v_pay_id, paid_at = now() where id = v_invoice;
    end if;
    update public.subscriptions
       set status = 'active', current_period_start = coalesce(current_period_start, v_start), current_period_end = v_end, updated_at = now()
     where id = v_sub.id;
    insert into public.subscription_events (subscription_id, kind, data)
      values (v_sub.id, 'payment_approved', jsonb_build_object('provider', 'mercadopago', 'payment', v_pay_id, 'until', v_end));
    return jsonb_build_object('subscription_id', v_sub.id, 'status', 'active', 'current_period_end', v_end);
  end if;

  if (p_resource ->> 'status') = 'recycling' or v_pay_status in ('rejected', 'cancelled') then
    if v_sub.status = 'active' then
      update public.subscriptions set status = 'past_due', updated_at = now() where id = v_sub.id;
    end if;
    insert into public.subscription_events (subscription_id, kind, data)
      values (v_sub.id, 'payment_failed', jsonb_build_object('provider', 'mercadopago', 'status', coalesce(v_pay_status, p_resource ->> 'status')));
    return jsonb_build_object('subscription_id', v_sub.id, 'status', 'past_due');
  end if;

  return jsonb_build_object('subscription_id', v_sub.id, 'noop', true);
end $$;

-- O gateway não aceita nome de função arbitrário, identidade declarada pelo cliente
-- nem SQL dinâmico. A Edge Function fornece a identidade já validada no produto.
create function public.billing_product_call(p_product text, p_action text, p_args jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.products where id = p_product and active) then
    raise exception using message = 'Produto não autorizado.', detail = 'INVALID_PRODUCT';
  end if;
  perform set_config('billing.product_id', p_product, true);
  case p_action
    when 'overview' then return public.billing_overview((p_args->>'p_identity')::uuid);
    when 'subscription_result' then return public.billing_subscription_result((p_args->>'p_identity')::uuid,p_args->>'p_idempotency_key');
    when 'subscribe' then return public.billing_subscribe((p_args->>'p_identity')::uuid,p_args->>'p_email',p_args->>'p_name',p_args->>'p_plan',p_args->>'p_restaurant_name',p_args->>'p_slug',p_args->>'p_user_agent',p_args->>'p_idempotency_key');
    when 'payment_context' then return public.billing_payment_context((p_args->>'p_identity')::uuid,(p_args->>'p_subscription')::uuid);
    when 'payment_started' then
      perform public.billing_payment_started((p_args->>'p_subscription')::uuid,p_args->>'p_provider_subscription_id',p_args->>'p_checkout_url');
      return null;
    when 'cancel' then return public.billing_cancel((p_args->>'p_identity')::uuid,(p_args->>'p_subscription')::uuid,(p_args->>'p_undo')::boolean);
    else raise exception using message = 'Ação desconhecida.', detail = 'INVALID';
  end case;
end $$;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Catálogo público explicitamente associado ao produto, sem publicar configuração Auth.
create function public.billing_public_plans(p_product text) returns setof public.plans
language sql stable security definer set search_path = '' as $$
  select p.* from public.plans p join public.products x on x.id = p.product_id
  where p.product_id = p_product and p.active and x.active order by p.position
$$;
revoke all on function public.billing_public_plans(text) from public;
grant execute on function public.billing_public_plans(text) to anon, authenticated, service_role;
