-- Modelos visuais públicos do Cardápio Digital e do Delivery, escolhidos pelo
-- restaurante na Gestão (claro/escuro continua sendo escolha do cliente).
-- * tenant_update_settings aceita cardapio_template e delivery_template (m1..m4),
--   autorizados por cardapio.configurar e delivery.configurar.
-- * Um mesmo pedido de alteração não mistura áreas (cardápio, delivery, operação):
--   cada área é autorizada pela sua própria permissão.
-- * public_templates(slug) devolve só os modelos escolhidos, sem dados sensíveis.

create or replace function public.tenant_update_settings(p_tenant uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_allowed text[] := array[
    'local_order_mode', 'local_order_confirmation', 'kitchen_delivers', 'kitchen_stages',
    'service_fee_percent', 'delivery_enabled', 'delivery_responsible', 'delivery_payment_on',
    'delivery_eta_minutes', 'delivery_whatsapp', 'publicity_responsible',
    'cardapio_template', 'delivery_template'];
  v_key text;
  v_settings jsonb;
  v_approval uuid;
  v_groups text[];
begin
  for v_key in select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) loop
    if v_key <> all (v_allowed) then
      perform private.fail('INVALID', 'Configuração desconhecida: ' || v_key);
    end if;
  end loop;
  -- Cada alteração pertence a uma única área, autorizada pela permissão daquela área
  select array_agg(distinct case
           when k in ('local_order_mode', 'local_order_confirmation', 'cardapio_template') then 'cardapio'
           when k like 'delivery\_%' then 'delivery'
           else 'operacao' end)
    into v_groups
    from jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) as k;
  if coalesce(array_length(v_groups, 1), 0) <> 1 then
    perform private.fail('INVALID', 'Altere as configurações de uma área por vez.');
  end if;
  if v_groups[1] = 'cardapio' then
    v_approval := private.authorize(p_tenant, 'cardapio.configurar');
  elsif v_groups[1] = 'delivery' then
    v_approval := private.authorize(p_tenant, 'delivery.configurar');
  else
    v_approval := private.authorize(p_tenant, 'gestao.operacao.alterar');
  end if;
  if p_patch ? 'local_order_mode' and (p_patch ->> 'local_order_mode') not in ('consulta', 'cliente', 'garcom', 'ambos') then
    perform private.fail('INVALID', 'Modo de pedido inválido.');
  end if;
  if p_patch ? 'local_order_confirmation' and (p_patch ->> 'local_order_confirmation') not in ('automatica', 'atendente') then
    perform private.fail('INVALID', 'Regra de confirmação inválida.');
  end if;
  if p_patch ? 'delivery_responsible' and (p_patch ->> 'delivery_responsible') not in ('titular', 'administrativo', 'cozinha', 'atendimento') then
    perform private.fail('INVALID', 'Responsável pelo delivery inválido.');
  end if;
  if p_patch ? 'service_fee_percent' and ((p_patch ->> 'service_fee_percent')::numeric < 0 or (p_patch ->> 'service_fee_percent')::numeric > 30) then
    perform private.fail('INVALID', 'Taxa de serviço deve estar entre 0% e 30%.');
  end if;
  if p_patch ? 'cardapio_template' and (p_patch ->> 'cardapio_template') not in ('m1', 'm2', 'm3', 'm4') then
    perform private.fail('INVALID', 'Modelo de cardápio inválido.');
  end if;
  if p_patch ? 'delivery_template' and (p_patch ->> 'delivery_template') not in ('m1', 'm2', 'm3', 'm4') then
    perform private.fail('INVALID', 'Modelo de delivery inválido.');
  end if;
  update public.tenants set settings = settings || p_patch where id = p_tenant returning settings into v_settings;
  perform private.audit(p_tenant, 'gestao', 'tenant.settings_updated', 'tenant', p_tenant::text, p_patch, v_approval);
  return v_settings;
end $$;

create or replace function public.public_templates(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'cardapio', coalesce((select t.settings ->> 'cardapio_template' from public.tenants t where t.slug = lower(trim(p_slug))), 'm1'),
    'delivery', coalesce((select t.settings ->> 'delivery_template' from public.tenants t where t.slug = lower(trim(p_slug))), 'm2')
  );
$$;

revoke execute on function public.public_templates(text) from public;
grant execute on function public.public_templates(text) to anon, authenticated, service_role;
