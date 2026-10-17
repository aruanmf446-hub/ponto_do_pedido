-- Ponto do Pedido: avaliação controlada no servidor, sem cobrança nem invoice inicial.
-- Os outros produtos da central CRM PLUS não recebem testes automaticamente.
create or replace function public.billing_start_trial(
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
 v_started timestamptz;
begin
 if public.billing_current_product() <> 'ponto_do_pedido' then
   raise exception using message = 'Teste gratuito indisponível.', detail = 'INVALID_PRODUCT';
 end if;
 -- Trava por identidade, não por tentativa. Nem múltiplos cliques nem outra chave geram testes repetidos.
 perform pg_advisory_xact_lock(hashtextextended(public.billing_current_product() || ':' || p_identity::text, 77));
 v_account := public.billing_upsert_account(p_identity, p_email, p_name);
 select result into v_existing from public.idempotency
   where product_id = public.billing_current_product() and account_id = v_account.id and key = p_idempotency_key;
 if found then
   select * into v_sub from public.subscriptions
     where id = (v_existing->>'subscription_id')::uuid and account_id = v_account.id;
   if v_sub.id is not null then
     return jsonb_build_object('subscription_id', v_sub.id, 'status', v_sub.status);
   end if;
 end if;
 if exists (select 1 from public.subscriptions where account_id = v_account.id and product_id='ponto_do_pedido' and trial_started_at is not null) then
   raise exception using message = 'Esta conta já utilizou o teste gratuito.', detail = 'TRIAL_ALREADY_USED';
 end if;
 select * into v_plan from public.plans
   where product_id='ponto_do_pedido' and code = p_plan and active;
 if not found then raise exception using message = 'Plano indisponível.', detail = 'INVALID_PLAN'; end if;
 if char_length(trim(coalesce(p_restaurant_name, ''))) < 2 then
   raise exception using message = 'Informe o nome do restaurante.', detail = 'INVALID';
 end if;
 if length(p_slug) < 3 or length(p_slug) > 40 or p_slug !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' then
   raise exception using message = 'Endereço do restaurante inválido.', detail = 'INVALID_SLUG';
 end if;
 if exists (select 1 from public.subscriptions where product_id='ponto_do_pedido' and restaurant_slug=lower(trim(p_slug))) then
   raise exception using message = 'Este endereço já está em uso.', detail = 'SLUG_TAKEN';
 end if;
 select terms_version into v_terms from public.products where id = 'ponto_do_pedido';
 v_started := now();
 insert into public.subscriptions (
   account_id, plan_code, status, restaurant_name, restaurant_slug,
   current_period_start, current_period_end, trial_started_at, trial_ends_at
 ) values (
   v_account.id, v_plan.code, 'trialing', trim(p_restaurant_name), lower(trim(p_slug)),
   v_started, v_started + interval '7 days', v_started, v_started + interval '7 days'
 ) returning * into v_sub;
 insert into public.contracts(subscription_id, terms_version, plan_code, accepted_by, user_agent)
   values (v_sub.id, coalesce(v_terms, 'v1'), v_plan.code, p_identity, left(p_user_agent,300));
 insert into public.subscription_events(subscription_id,kind,data,actor_identity)
   values (v_sub.id,'trial_started', jsonb_build_object('plan',v_plan.code,'ends_at',v_sub.trial_ends_at),p_identity);
 v_result := jsonb_build_object('subscription_id',v_sub.id,'status','trialing','trial_ends_at',v_sub.trial_ends_at);
 insert into public.idempotency(key,account_id,result) values (p_idempotency_key,v_account.id,v_result);
 return v_result;
end $$;
revoke all on function public.billing_start_trial(uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.billing_start_trial(uuid,text,text,text,text,text,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.billing_product_call(p_product text, p_action text, p_args jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists(select 1 from public.products where id = p_product and active) then
    raise exception using message = 'Produto não autorizado.', detail = 'INVALID_PRODUCT';
  end if;
  perform set_config('billing.product_id', p_product, true);
  case p_action
    when 'overview' then return public.billing_overview((p_args->>'p_identity')::uuid);
    when 'subscription_result' then return public.billing_subscription_result((p_args->>'p_identity')::uuid,p_args->>'p_idempotency_key');
    when 'start_trial' then
      if p_product <> 'ponto_do_pedido' then
        raise exception using message = 'Teste grátis indisponível para este produto.', detail = 'INVALID_PRODUCT';
      end if;
      return public.billing_start_trial((p_args->>'p_identity')::uuid, p_args->>'p_email', p_args->>'p_name',
        p_args->>'p_plan', p_args->>'p_restaurant_name', p_args->>'p_slug', p_args->>'p_user_agent', p_args->>'p_idempotency_key');
    when 'subscribe' then return public.billing_subscribe((p_args->>'p_identity')::uuid,p_args->>'p_email',p_args->>'p_name',p_args->>'p_plan',p_args->>'p_restaurant_name',p_args->>'p_slug',p_args->>'p_user_agent',p_args->>'p_idempotency_key');
    when 'payment_context' then return public.billing_payment_context((p_args->>'p_identity')::uuid,(p_args->>'p_subscription')::uuid);
    when 'payment_started' then
      perform public.billing_payment_started((p_args->>'p_subscription')::uuid,p_args->>'p_provider_subscription_id',p_args->>'p_checkout_url');
      return null;
    when 'cancel' then return public.billing_cancel((p_args->>'p_identity')::uuid,(p_args->>'p_subscription')::uuid,(p_args->>'p_undo')::boolean);
    else raise exception using message = 'Ação desconhecida.', detail = 'INVALID';
  end case;
end $function$
;

CREATE OR REPLACE FUNCTION public.billing_overview(p_identity uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        'current_period_end', s.current_period_end, 'trial_started_at', s.trial_started_at, 'trial_ends_at', s.trial_ends_at, 'cancel_at_period_end', s.cancel_at_period_end,
        'created_at', s.created_at, 'provider_status', s.provider_status, 'next_payment_at', s.next_payment_at,
        'payment_url', s.provider_checkout_url,
        'invoices', (select coalesce(jsonb_agg(to_jsonb(i) order by i.period_start desc), '[]'::jsonb)
                     from (select * from public.invoices where subscription_id = s.id order by period_start desc limit 12) i)
      ) order by s.created_at)
      from public.subscriptions s join public.accounts a on a.id = s.account_id join public.plans p on p.code = s.plan_code and p.product_id = s.product_id
      where a.identity_user_id = p_identity and a.product_id = public.billing_current_product()), '[]'::jsonb)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.billing_payment_context(p_identity uuid, p_subscription uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v public.subscriptions;
  v_plan public.plans;
  v_account public.accounts;
begin
  if public.billing_payment_provider() is distinct from 'mercadopago' then
    raise exception using message = 'O pagamento online ainda não está habilitado.', detail = 'PAYMENT_DISABLED';
  end if;
  v := public.billing_lock_subscription(p_identity, p_subscription);
  if v.status not in ('pending_payment', 'past_due', 'trialing')
    and not (v.status = 'suspended' and v.trial_started_at is not null) then
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
end $function$
;

CREATE OR REPLACE FUNCTION public.billing_settle_expired()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update public.subscriptions set status = 'cancelled', updated_at = now()
  where cancel_at_period_end and status in ('active', 'past_due') and current_period_end <= now();
  update public.subscriptions set status = 'suspended', updated_at = now()
  where status = 'trialing' and trial_ends_at <= now();
$function$
;
