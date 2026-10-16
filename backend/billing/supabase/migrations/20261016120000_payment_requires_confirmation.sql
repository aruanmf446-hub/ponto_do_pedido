-- Ligar o provedor de pagamento basta para exigir pagamento na contratação:
-- billing_subscribe passa a criar a assinatura pendente sempre que payment_provider
-- não for nulo, mesmo que activation_mode continue 'immediate'.

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
  -- Com cobrança online ligada, a assinatura só ativa quando o pagamento for confirmado,
  -- seja qual for o activation_mode (evita ativar sem pagar por esquecer de trocar o modo).
  if public.billing_payment_provider() is not null then v_activation := 'on_payment'; end if;
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

revoke execute on function public.billing_subscribe(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.billing_subscribe(uuid, text, text, text, text, text, text, text) to service_role;
