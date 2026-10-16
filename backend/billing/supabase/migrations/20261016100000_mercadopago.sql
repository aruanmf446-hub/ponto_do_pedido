-- Pagamento por Mercado Pago (assinaturas recorrentes). Exclusivo do projeto
-- assinaturas: nada daqui existe no banco do restaurante. O titular da plataforma
-- liga o recurso com:
--   update public.platform_settings set value = '"mercadopago"' where key = 'payment_provider';
--   update public.platform_settings set value = '"on_payment"' where key = 'activation_mode';
-- Enquanto payment_provider for nulo, nenhuma cobrança é iniciada.

alter table public.subscriptions
  add column provider text,
  add column provider_subscription_id text,
  add column provider_checkout_url text,
  add column provider_status text,
  add column next_payment_at timestamptz;

create unique index subscriptions_provider_subscription_uidx
  on public.subscriptions (provider, provider_subscription_id) where provider_subscription_id is not null;

-- Um pagamento do provedor gera no máximo uma fatura.
create unique index invoices_provider_reference_uidx
  on public.invoices (provider, provider_reference) where provider_reference is not null;

-- Caixa de entrada dos webhooks: idempotência e trilha de auditoria.
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_key text not null,
  kind text not null,
  resource_id text,
  payload jsonb not null default '{}'::jsonb,
  error text,
  received_at timestamptz not null default now(),
  unique (provider, event_key)
);
alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;

create or replace function public.billing_payment_provider()
returns text language sql stable security definer set search_path = '' as $$
  select nullif(value #>> '{}', 'null') from public.platform_settings where key = 'payment_provider'
$$;

-- Dados para iniciar o pagamento de uma assinatura do titular.
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
  select * into v_plan from public.plans where code = v.plan_code;
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
   where id = p_subscription;
  insert into public.subscription_events (subscription_id, kind, data)
    values (p_subscription, 'payment_started', jsonb_build_object('provider', 'mercadopago'));
end $$;

-- Aplica um recurso do Mercado Pago (já consultado na API pelo webhook).
-- p_kind: 'preapproval' (assinatura) ou 'authorized_payment' (cobrança).
-- Idempotente por p_event_key.
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
    select price_cents into v_plan_amount from public.plans where code = v_sub.plan_code;
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

-- Com cobrança online, renovação e troca de plano passam pelo pagamento: nunca
-- estendem o período de graça sem o provedor confirmar.
create or replace function public.billing_renew(p_identity uuid, p_subscription uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.subscriptions;
  v_start timestamptz;
  v_end timestamptz;
  v_price bigint;
begin
  if public.billing_payment_provider() is not null then
    raise exception using message = 'A renovação acontece pela cobrança online.', detail = 'PAYMENT_REQUIRED';
  end if;
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
  if public.billing_payment_provider() is not null then
    raise exception using message = 'A troca de plano com cobrança online ainda não está disponível.', detail = 'PAYMENT_REQUIRED';
  end if;
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

-- Situação comercial do titular, agora com o estado do pagamento online.
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
        'created_at', s.created_at, 'provider_status', s.provider_status, 'next_payment_at', s.next_payment_at,
        'payment_url', s.provider_checkout_url,
        'invoices', (select coalesce(jsonb_agg(to_jsonb(i) order by i.period_start desc), '[]'::jsonb)
                     from (select * from public.invoices where subscription_id = s.id order by period_start desc limit 12) i)
      ) order by s.created_at)
      from public.subscriptions s join public.accounts a on a.id = s.account_id join public.plans p on p.code = s.plan_code
      where a.identity_user_id = p_identity), '[]'::jsonb)
  )
$$;

revoke execute on function public.billing_payment_provider() from public, anon, authenticated;
revoke execute on function public.billing_payment_context(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.billing_payment_started(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.billing_apply_mercadopago(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.billing_payment_provider() to service_role;
grant execute on function public.billing_payment_context(uuid, uuid) to service_role;
grant execute on function public.billing_payment_started(uuid, text, text) to service_role;
grant execute on function public.billing_apply_mercadopago(text, text, jsonb) to service_role;
