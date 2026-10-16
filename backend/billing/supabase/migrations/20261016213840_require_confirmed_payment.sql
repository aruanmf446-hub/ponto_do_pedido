-- PREPARADA: aplicação remota depende de autorização específica.
-- Não altera settings, preços, pagamentos nem assinaturas existentes.
-- Assinaturas legadas ativas NÃO são reclassificadas: analisar dados antes de aplicar.

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
  perform pg_advisory_xact_lock(hashtextextended(p_identity::text || ':' || p_idempotency_key, 0));
  v_account := public.billing_upsert_account(p_identity, p_email, p_name);
  select result into v_existing from public.idempotency where key = p_idempotency_key and account_id = v_account.id;
  if found then
    select * into v_sub from public.subscriptions
      where id = (v_existing ->> 'subscription_id')::uuid and account_id = v_account.id;
    return jsonb_build_object('subscription_id', v_sub.id, 'status', v_sub.status);
  end if;

  select * into v_plan from public.plans where code = p_plan and active;
  if not found then raise exception using message = 'Plano indisponível.', detail = 'INVALID_PLAN'; end if;
  if char_length(trim(coalesce(p_restaurant_name, ''))) < 2 then
    raise exception using message = 'Informe o nome do restaurante.', detail = 'INVALID';
  end if;
  if exists (select 1 from public.subscriptions where restaurant_slug = lower(trim(p_slug))) then
    raise exception using message = 'Este endereço já está em uso.', detail = 'SLUG_TAKEN';
  end if;

  -- O cadastro nunca comprova pagamento, independentemente do provedor e modo legado.
  select value #>> '{}' into v_terms from public.platform_settings where key = 'terms_version';

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

revoke execute on function public.billing_subscribe(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.billing_subscribe(uuid, text, text, text, text, text, text, text) to service_role;

-- Renovação e upgrade não podem liberar período/módulos por uma chamada do cliente.
create or replace function public.billing_renew(p_identity uuid, p_subscription uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.billing_lock_subscription(p_identity, p_subscription);
  raise exception using message = 'A renovação exige confirmação de pagamento.', detail = 'PAYMENT_REQUIRED';
end $$;

create or replace function public.billing_change_plan(p_identity uuid, p_subscription uuid, p_plan text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.billing_lock_subscription(p_identity, p_subscription);
  raise exception using message = 'A alteração do plano exige confirmação de pagamento.', detail = 'PAYMENT_REQUIRED';
end $$;

-- Capacidade consultada pela Edge Function antes de aceitar uma nova contratação.
-- Só existe depois de as RPCs acima estarem protegidas na mesma migração.
create or replace function public.billing_checkout_policy()
returns jsonb language sql immutable security invoker set search_path = '' as $$
  select jsonb_build_object('requires_payment', true, 'version', 1)
$$;
revoke execute on function public.billing_checkout_policy() from public, anon, authenticated;
grant execute on function public.billing_checkout_policy() to service_role;
revoke execute on function public.billing_renew(uuid,uuid), public.billing_change_plan(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.billing_renew(uuid,uuid), public.billing_change_plan(uuid,uuid,text) to service_role;

-- Permite recuperar a contratação antes da validação de slug do banco operacional.
create or replace function public.billing_subscription_result(p_identity uuid, p_idempotency_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('subscription_id', s.id, 'status', s.status)
  from public.idempotency i join public.accounts a on a.id = i.account_id
    join public.subscriptions s on s.id = (i.result ->> 'subscription_id')::uuid and s.account_id = a.id
  where a.identity_user_id = p_identity and i.key = p_idempotency_key
$$;
revoke execute on function public.billing_subscription_result(uuid,text) from public, anon, authenticated;
grant execute on function public.billing_subscription_result(uuid,text) to service_role;
