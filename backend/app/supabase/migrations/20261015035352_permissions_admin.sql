-- Catálogo de permissões, funções padrão, provisionamento do estabelecimento
-- e administração de equipe/delegações.

insert into public.permissions (code, module, label, action, supports_limit, approvable) values
  -- Gestão
  ('gestao.acessar', 'gestao', 'Acessar a Gestão', 'acessar', false, false),
  ('gestao.indicadores.visualizar', 'gestao', 'Consultar indicadores e relatórios', 'visualizar', false, false),
  ('gestao.licencas.visualizar', 'gestao', 'Consultar licenças e módulos', 'visualizar', false, false),
  ('gestao.restaurante.alterar', 'gestao', 'Alterar informações do restaurante', 'alterar', false, true),
  ('gestao.operacao.alterar', 'gestao', 'Alterar configurações operacionais', 'alterar', false, true),
  ('gestao.equipe.visualizar', 'gestao', 'Consultar colaboradores', 'visualizar', false, false),
  ('gestao.equipe.cadastrar', 'gestao', 'Cadastrar colaboradores', 'cadastrar', false, true),
  ('gestao.equipe.alterar', 'gestao', 'Alterar e suspender colaboradores', 'alterar', false, true),
  ('gestao.permissoes.alterar', 'gestao', 'Definir funções e permissões', 'alterar', false, true),
  ('gestao.permissoes.delegar', 'gestao', 'Delegar permissões a outros usuários', 'delegar', false, true),
  ('gestao.aprovacoes.visualizar', 'gestao', 'Consultar solicitações de aprovação', 'visualizar', false, false),
  ('gestao.historico.visualizar', 'gestao', 'Consultar histórico e auditoria', 'visualizar', false, false),
  -- Cadastros compartilhados (registros oficiais únicos)
  ('cadastros.mesas.visualizar', 'gestao', 'Consultar mesas', 'visualizar', false, false),
  ('cadastros.mesas.cadastrar', 'gestao', 'Cadastrar mesas', 'cadastrar', false, true),
  ('cadastros.mesas.alterar', 'gestao', 'Alterar mesas', 'alterar', false, true),
  ('cadastros.mesas.excluir', 'gestao', 'Excluir mesas', 'excluir', false, true),
  ('cadastros.setores.cadastrar', 'gestao', 'Cadastrar setores', 'cadastrar', false, true),
  ('cadastros.setores.alterar', 'gestao', 'Alterar setores', 'alterar', false, true),
  ('cadastros.setores.excluir', 'gestao', 'Excluir setores', 'excluir', false, true),
  ('cadastros.categorias.cadastrar', 'gestao', 'Cadastrar categorias', 'cadastrar', false, true),
  ('cadastros.categorias.alterar', 'gestao', 'Alterar categorias', 'alterar', false, true),
  ('cadastros.categorias.excluir', 'gestao', 'Excluir categorias', 'excluir', false, true),
  ('cadastros.produtos.cadastrar', 'gestao', 'Cadastrar produtos', 'cadastrar', false, true),
  ('cadastros.produtos.alterar', 'gestao', 'Alterar produtos', 'alterar', false, true),
  ('cadastros.produtos.excluir', 'gestao', 'Excluir produtos', 'excluir', false, true),
  ('cadastros.precos.alterar', 'gestao', 'Alterar preços', 'alterar', false, true),
  ('cadastros.taxas.alterar', 'gestao', 'Cadastrar e alterar taxas', 'alterar', false, true),
  ('cadastros.horarios.alterar', 'gestao', 'Alterar horários de funcionamento', 'alterar', false, true),
  ('cadastros.suprimentos.alterar', 'gestao', 'Cadastrar e alterar suprimentos', 'alterar', false, true),
  ('cadastros.pagamentos.alterar', 'gestao', 'Configurar métodos de pagamento', 'alterar', false, true),
  -- Atendimento
  ('atendimento.acessar', 'atendimento', 'Acessar o Atendimento', 'acessar', false, false),
  ('atendimento.comanda.abrir', 'atendimento', 'Abrir comandas', 'executar', false, false),
  ('atendimento.pedido.registrar', 'atendimento', 'Registrar pedidos', 'executar', false, false),
  ('atendimento.pedido.confirmar_cliente', 'atendimento', 'Confirmar pedidos feitos pelo cliente', 'executar', false, false),
  ('atendimento.pedido.cancelar', 'atendimento', 'Cancelar pedidos e itens', 'executar', true, true),
  ('atendimento.entrega.confirmar', 'atendimento', 'Confirmar entrega à mesa', 'executar', false, false),
  ('atendimento.mesa.transferir', 'atendimento', 'Transferir mesa', 'executar', false, true),
  ('atendimento.pagamento.receber', 'atendimento', 'Receber pagamentos no atendimento', 'executar', false, false),
  ('atendimento.comanda.encerrar', 'atendimento', 'Encerrar comandas', 'executar', false, false),
  -- Cozinha
  ('cozinha.acessar', 'cozinha', 'Acessar a Cozinha', 'acessar', false, false),
  ('cozinha.preparo.executar', 'cozinha', 'Iniciar e concluir preparo', 'executar', false, false),
  ('cozinha.item.indisponivel', 'cozinha', 'Sinalizar indisponibilidade', 'executar', false, false),
  ('cozinha.entrega.confirmar', 'cozinha', 'Confirmar saída/entrega pela cozinha', 'executar', false, false),
  ('cozinha.pedido.cancelar', 'cozinha', 'Cancelar pedidos na produção', 'executar', false, true),
  -- Caixa
  ('caixa.acessar', 'caixa', 'Acessar o Caixa', 'acessar', false, false),
  ('caixa.abrir', 'caixa', 'Abrir caixa', 'executar', false, false),
  ('caixa.receber', 'caixa', 'Receber cobranças', 'executar', false, false),
  ('caixa.desconto', 'caixa', 'Conceder descontos', 'executar', true, true),
  ('caixa.estorno', 'caixa', 'Estornar pagamentos', 'executar', true, true),
  ('caixa.sangria', 'caixa', 'Registrar sangrias', 'executar', true, true),
  ('caixa.suprimento', 'caixa', 'Registrar suprimentos de caixa', 'executar', false, false),
  ('caixa.fechar', 'caixa', 'Conferir e fechar caixa', 'executar', false, false),
  ('caixa.historico.visualizar', 'caixa', 'Consultar histórico transacional', 'visualizar', false, false),
  -- Cardápio local e Delivery
  ('cardapio.configurar', 'cardapio', 'Configurar cardápio local e QR Codes', 'alterar', false, true),
  ('delivery.configurar', 'delivery', 'Configurar delivery', 'alterar', false, true),
  ('delivery.pedido.aceitar', 'delivery', 'Aceitar ou recusar pedidos de delivery', 'executar', false, false),
  ('delivery.pedido.despachar', 'delivery', 'Despachar e confirmar entregas', 'executar', false, false),
  -- Administrativo e Financeiro
  ('financeiro.acessar', 'financeiro', 'Acessar Administrativo e Financeiro', 'acessar', false, false),
  ('financeiro.compras.solicitar', 'financeiro', 'Solicitar compras', 'executar', false, false),
  ('financeiro.compras.cotar', 'financeiro', 'Registrar cotações', 'executar', false, false),
  ('financeiro.compras.aprovar', 'financeiro', 'Aprovar compras', 'aprovar', true, true),
  ('financeiro.compras.comprar', 'financeiro', 'Emitir pedidos de compra', 'executar', false, false),
  ('financeiro.fornecedores.gerir', 'financeiro', 'Cadastrar e alterar fornecedores', 'alterar', false, false),
  ('financeiro.recebimento.conferir', 'financeiro', 'Conferir recebimentos', 'executar', false, false),
  ('financeiro.pagar.gerir', 'financeiro', 'Registrar contas a pagar e despesas', 'executar', false, false),
  ('financeiro.pagar.pagar', 'financeiro', 'Registrar pagamento de contas', 'executar', true, true),
  ('financeiro.receber.gerir', 'financeiro', 'Gerir contas a receber', 'executar', false, false),
  ('financeiro.documentos.gerir', 'financeiro', 'Gerir contratos, notas e comprovantes', 'executar', false, false),
  ('financeiro.conciliacao.executar', 'financeiro', 'Conciliar e consultar fluxo de caixa', 'executar', false, false),
  ('financeiro.orcamentos.gerir', 'financeiro', 'Gerir orçamentos', 'alterar', false, true),
  ('financeiro.reembolsos.solicitar', 'financeiro', 'Solicitar reembolsos', 'executar', false, false),
  ('financeiro.reembolsos.aprovar', 'financeiro', 'Aprovar reembolsos', 'aprovar', true, true),
  ('financeiro.suprimentos.autorizar', 'financeiro', 'Autorizar atendimento de suprimentos', 'aprovar', false, false),
  -- Estoque
  ('estoque.acessar', 'estoque', 'Acessar o Estoque', 'acessar', false, false),
  ('estoque.materiais.gerir', 'estoque', 'Cadastrar materiais, unidades e locais', 'alterar', false, false),
  ('estoque.entrada.registrar', 'estoque', 'Registrar entradas e recebimentos', 'executar', false, false),
  ('estoque.saida.registrar', 'estoque', 'Registrar saídas', 'executar', false, false),
  ('estoque.transferir', 'estoque', 'Movimentar entre localizações', 'executar', false, false),
  ('estoque.ajuste.registrar', 'estoque', 'Registrar ajustes', 'executar', true, true),
  ('estoque.perda.registrar', 'estoque', 'Registrar perdas e descartes', 'executar', true, true),
  ('estoque.inventario.executar', 'estoque', 'Executar conferência e inventário', 'executar', false, false),
  ('estoque.lote.bloquear', 'estoque', 'Bloquear e liberar lotes', 'executar', false, true),
  ('estoque.solicitacao.criar', 'estoque', 'Solicitar materiais', 'executar', false, false),
  ('estoque.solicitacao.atender', 'estoque', 'Atender solicitações de materiais', 'executar', false, false);

-- ---------------------------------------------------------------------------
-- Funções padrão (editáveis por estabelecimento; um cargo não implica as
-- mesmas permissões em todos os estabelecimentos).
-- ---------------------------------------------------------------------------
create or replace function private.seed_default_roles(p_tenant uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_role uuid;
  r record;
begin
  for r in
    select * from (values
      ('Gestor', 'Administra o restaurante dentro dos limites definidos pelo titular.', array[
        'gestao.acessar', 'gestao.indicadores.visualizar', 'gestao.licencas.visualizar', 'gestao.restaurante.alterar',
        'gestao.operacao.alterar', 'gestao.equipe.visualizar', 'gestao.equipe.cadastrar', 'gestao.equipe.alterar',
        'gestao.permissoes.alterar', 'gestao.aprovacoes.visualizar', 'gestao.historico.visualizar',
        'cadastros.mesas.visualizar', 'cadastros.mesas.cadastrar', 'cadastros.mesas.alterar', 'cadastros.mesas.excluir',
        'cadastros.setores.cadastrar', 'cadastros.setores.alterar', 'cadastros.setores.excluir',
        'cadastros.categorias.cadastrar', 'cadastros.categorias.alterar', 'cadastros.categorias.excluir',
        'cadastros.produtos.cadastrar', 'cadastros.produtos.alterar', 'cadastros.produtos.excluir',
        'cadastros.precos.alterar', 'cadastros.taxas.alterar', 'cadastros.horarios.alterar',
        'cadastros.suprimentos.alterar', 'cadastros.pagamentos.alterar', 'cardapio.configurar', 'delivery.configurar']),
      ('Supervisor', 'Acompanha a equipe sob sua responsabilidade.', array[
        'atendimento.acessar', 'atendimento.comanda.abrir', 'atendimento.pedido.registrar',
        'atendimento.pedido.confirmar_cliente', 'atendimento.pedido.cancelar', 'atendimento.entrega.confirmar',
        'atendimento.mesa.transferir', 'atendimento.comanda.encerrar', 'cadastros.mesas.visualizar',
        'gestao.equipe.visualizar', 'gestao.aprovacoes.visualizar']),
      ('Atendente', 'Garçom ou atendente do salão.', array[
        'atendimento.acessar', 'atendimento.comanda.abrir', 'atendimento.pedido.registrar',
        'atendimento.pedido.confirmar_cliente', 'atendimento.entrega.confirmar', 'atendimento.comanda.encerrar',
        'cadastros.mesas.visualizar']),
      ('Caixa', 'Operador de caixa.', array[
        'caixa.acessar', 'caixa.abrir', 'caixa.receber', 'caixa.suprimento', 'caixa.fechar',
        'caixa.historico.visualizar']),
      ('Cozinha', 'Produção de pedidos.', array[
        'cozinha.acessar', 'cozinha.preparo.executar', 'cozinha.item.indisponivel', 'cozinha.entrega.confirmar',
        'estoque.solicitacao.criar']),
      ('Administrativo', 'Compras, contas e documentos.', array[
        'financeiro.acessar', 'financeiro.compras.solicitar', 'financeiro.compras.cotar', 'financeiro.compras.comprar',
        'financeiro.fornecedores.gerir', 'financeiro.recebimento.conferir', 'financeiro.pagar.gerir',
        'financeiro.receber.gerir', 'financeiro.documentos.gerir', 'financeiro.conciliacao.executar',
        'financeiro.reembolsos.solicitar', 'delivery.pedido.aceitar', 'delivery.pedido.despachar']),
      ('Estoquista', 'Controle de estoque e suprimentos.', array[
        'estoque.acessar', 'estoque.materiais.gerir', 'estoque.entrada.registrar', 'estoque.saida.registrar',
        'estoque.transferir', 'estoque.inventario.executar', 'estoque.solicitacao.criar', 'estoque.solicitacao.atender'])
    ) as t(name, description, perms)
  loop
    v_role := null;
    insert into public.roles (tenant_id, name, description) values (p_tenant, r.name, r.description)
      on conflict (tenant_id, name) do nothing
      returning id into v_role;
    if v_role is not null then
      insert into public.role_permissions (role_id, tenant_id, permission_code, mode)
        select v_role, p_tenant, unnest(r.perms), 'direct';
    end if;
  end loop;
  -- Limites e aprovações padrão (podem ser alterados pelo titular)
  insert into public.role_permissions (role_id, tenant_id, permission_code, mode, limit_cents)
  select ro.id, p_tenant, x.code, x.mode::public.grant_mode, x.lim
  from public.roles ro
  join (values
    ('Caixa', 'caixa.desconto', 'direct', 1000::bigint),
    ('Caixa', 'caixa.estorno', 'approval', null),
    ('Caixa', 'caixa.sangria', 'direct', 50000),
    ('Atendente', 'atendimento.pedido.cancelar', 'approval', null),
    ('Atendente', 'atendimento.mesa.transferir', 'approval', null),
    ('Supervisor', 'caixa.desconto', 'direct', 3000),
    ('Administrativo', 'financeiro.pagar.pagar', 'direct', 100000),
    ('Administrativo', 'financeiro.compras.aprovar', 'approval', null),
    ('Estoquista', 'estoque.ajuste.registrar', 'approval', null),
    ('Estoquista', 'estoque.perda.registrar', 'direct', 5000)
  ) as x(role_name, code, mode, lim) on x.role_name = ro.name
  where ro.tenant_id = p_tenant
  on conflict (role_id, permission_code) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- Provisionamento (somente service_role, chamado pela sincronização de licença)
-- ---------------------------------------------------------------------------
create or replace function public.admin_sync_license(
  p_owner uuid,
  p_subscription_id uuid,
  p_slug text,
  p_name text,
  p_status public.tenant_status,
  p_plan_code text,
  p_valid_until timestamptz,
  p_modules public.app_module[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_tenant public.tenants;
  v_owner_name text;
  v_slug text := lower(trim(p_slug));
begin
  select * into v_tenant from public.tenants where billing_subscription_id = p_subscription_id for update;
  if not found then
    if exists (select 1 from private.reserved_slugs where slug = v_slug) then
      perform private.fail('SLUG_RESERVED', 'Este endereço é reservado.');
    end if;
    if exists (select 1 from public.tenants where slug = v_slug) then
      perform private.fail('SLUG_TAKEN', 'Este endereço já está em uso.');
    end if;
    insert into public.tenants (slug, name, owner_user_id, status, plan_code, license_valid_until, billing_subscription_id)
    values (v_slug, p_name, p_owner, p_status, p_plan_code, p_valid_until, p_subscription_id)
    returning * into v_tenant;

    select coalesce(nullif(p.full_name, ''), u.email, 'Titular') into v_owner_name
      from auth.users u left join public.profiles p on p.user_id = u.id where u.id = p_owner;
    insert into public.memberships (tenant_id, user_id, display_name, job_title, is_owner, primary_app)
      values (v_tenant.id, p_owner, v_owner_name, 'Titular', true, 'gestao');
    perform private.seed_default_roles(v_tenant.id);
    insert into public.process_ownership (tenant_id, process)
      select v_tenant.id, unnest(array['estoque', 'compras', 'fornecedores', 'contas_pagar', 'contas_receber',
        'conciliacao', 'orcamentos', 'documentos', 'reembolsos']);
    insert into public.audit_log (tenant_id, actor_user_id, module, action, entity, entity_id, data)
      values (v_tenant.id, p_owner, 'gestao', 'tenant.provisioned', 'tenant', v_tenant.id::text,
        jsonb_build_object('slug', v_slug, 'plan', p_plan_code));
  else
    if v_tenant.owner_user_id <> p_owner then
      perform private.fail('OWNER_MISMATCH', 'A assinatura pertence a outro titular.');
    end if;
    update public.tenants set status = p_status, plan_code = p_plan_code, license_valid_until = p_valid_until
      where id = v_tenant.id;
    insert into public.audit_log (tenant_id, actor_user_id, module, action, entity, entity_id, data)
      values (v_tenant.id, p_owner, 'gestao', 'license.synced', 'tenant', v_tenant.id::text,
        jsonb_build_object('status', p_status, 'plan', p_plan_code, 'valid_until', p_valid_until, 'modules', p_modules));
  end if;

  delete from public.tenant_modules where tenant_id = v_tenant.id and module <> all (p_modules);
  insert into public.tenant_modules (tenant_id, module)
    select v_tenant.id, m from unnest(p_modules) m
    on conflict do nothing;
  return v_tenant.id;
end $$;

-- Busca de usuário por e-mail (somente service_role — função de equipe)
create or replace function public.admin_find_user_by_email(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;

-- Vincula um usuário (existente ou recém-criado) ao estabelecimento.
-- Chamado pela função de equipe com service_role, informando quem solicitou;
-- a autoridade do solicitante é validada aqui.
create or replace function public.admin_attach_member(
  p_actor uuid, p_tenant uuid, p_user uuid, p_display_name text, p_job_title text,
  p_primary_app public.app_module, p_role_ids uuid[], p_must_change_password boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
  v_role uuid;
  v_code text;
begin
  if private.evaluate_permission(p_actor, p_tenant, 'gestao.equipe.cadastrar') <> 'direct' then
    perform private.fail('FORBIDDEN', 'Você não tem permissão para cadastrar colaboradores.');
  end if;
  if p_actor = p_user then
    perform private.fail('SELF_ESCALATION', 'Não é possível alterar o próprio vínculo.');
  end if;
  if exists (select 1 from public.memberships where tenant_id = p_tenant and user_id = p_user and is_owner) then
    perform private.fail('OWNER_PROTECTED', 'O titular já pertence ao estabelecimento.');
  end if;
  -- Funções atribuídas só podem conter permissões que o solicitante pode delegar
  foreach v_role in array coalesce(p_role_ids, '{}') loop
    for v_code in select permission_code from public.role_permissions where role_id = v_role and tenant_id = p_tenant loop
      if not private.can_delegate(p_actor, p_tenant, v_code) then
        perform private.fail('DELEGATION_DENIED', 'Você não pode delegar a permissão ' || v_code || '.');
      end if;
    end loop;
  end loop;

  insert into public.memberships (tenant_id, user_id, display_name, job_title, primary_app, must_change_password, created_by)
  values (p_tenant, p_user, p_display_name, p_job_title, p_primary_app, coalesce(p_must_change_password, false), p_actor)
  on conflict (tenant_id, user_id) do update
    set status = 'active', display_name = excluded.display_name, job_title = excluded.job_title,
        primary_app = excluded.primary_app
  returning id into v_member;

  insert into public.membership_roles (membership_id, role_id, tenant_id, assigned_by)
    select v_member, r.id, p_tenant, p_actor from public.roles r
    where r.id = any (coalesce(p_role_ids, '{}')) and r.tenant_id = p_tenant
    on conflict do nothing;

  insert into public.audit_log (tenant_id, actor_user_id, module, action, entity, entity_id, data)
  values (p_tenant, p_actor, 'gestao', 'member.attached', 'membership', v_member::text,
    jsonb_build_object('user', p_user, 'roles', p_role_ids, 'primary_app', p_primary_app));
  return v_member;
end $$;

revoke execute on function public.admin_sync_license(uuid, uuid, text, text, public.tenant_status, text, timestamptz, public.app_module[]) from public, anon, authenticated;
revoke execute on function public.admin_find_user_by_email(text) from public, anon, authenticated;
revoke execute on function public.admin_attach_member(uuid, uuid, uuid, text, text, public.app_module, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.admin_sync_license(uuid, uuid, text, text, public.tenant_status, text, timestamptz, public.app_module[]) to service_role;
grant execute on function public.admin_find_user_by_email(text) to service_role;
grant execute on function public.admin_attach_member(uuid, uuid, uuid, text, text, public.app_module, uuid[], boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Consultas públicas e de contexto
-- ---------------------------------------------------------------------------
create or replace function public.slug_available(p_slug text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(trim(p_slug)) ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'
    and not exists (select 1 from private.reserved_slugs where slug = lower(trim(p_slug)))
    and not exists (select 1 from public.tenants where slug = lower(trim(p_slug)))
$$;

-- Informações mínimas para a tela de login do subdomínio (sem dados sensíveis).
create or replace function public.tenant_public_info(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id, 'slug', t.slug, 'name', t.name, 'logo_path', t.logo_path,
    'status', case
      when t.status = 'active' and (t.license_valid_until is null or t.license_valid_until > now()) then 'active'
      when t.status = 'active' then 'expired'
      else t.status::text end,
    'modules', coalesce((select jsonb_agg(m.module order by m.module) from public.tenant_modules m where m.tenant_id = t.id), '[]'::jsonb)
  )
  from public.tenants t where t.slug = lower(trim(p_slug))
$$;

-- Contexto completo do usuário autenticado no estabelecimento.
create or replace function public.my_context(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_tenant public.tenants;
  v_member public.memberships;
  v_perms jsonb;
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('state', 'anonymous');
  end if;
  select * into v_tenant from public.tenants where slug = lower(trim(p_slug));
  if not found then
    return jsonb_build_object('state', 'tenant_not_found');
  end if;
  select * into v_member from public.memberships where tenant_id = v_tenant.id and user_id = (select auth.uid());
  if not found or v_member.status = 'revoked' then
    return jsonb_build_object('state', 'no_membership', 'tenant', jsonb_build_object('name', v_tenant.name, 'slug', v_tenant.slug, 'logo_path', v_tenant.logo_path));
  end if;
  if v_member.status = 'suspended' then
    return jsonb_build_object('state', 'membership_suspended', 'tenant', jsonb_build_object('name', v_tenant.name, 'slug', v_tenant.slug, 'logo_path', v_tenant.logo_path));
  end if;
  if not private.tenant_operational(v_tenant.id) then
    return jsonb_build_object('state', 'tenant_inactive', 'is_owner', v_member.is_owner,
      'tenant', jsonb_build_object('name', v_tenant.name, 'slug', v_tenant.slug, 'status', v_tenant.status, 'logo_path', v_tenant.logo_path));
  end if;

  select coalesce(jsonb_object_agg(p.code, d.decision), '{}'::jsonb) into v_perms
  from public.permissions p
  cross join lateral (select private.evaluate_permission((select auth.uid()), v_tenant.id, p.code) as decision) d
  where d.decision <> 'deny';

  return jsonb_build_object(
    'state', 'ok',
    'tenant', jsonb_build_object(
      'id', v_tenant.id, 'slug', v_tenant.slug, 'name', v_tenant.name, 'logo_path', v_tenant.logo_path,
      'timezone', v_tenant.timezone, 'business_day_start_hour', v_tenant.business_day_start_hour,
      'plan_code', v_tenant.plan_code, 'license_valid_until', v_tenant.license_valid_until,
      'settings', v_tenant.settings, 'onboarding_completed_at', v_tenant.onboarding_completed_at),
    'membership', jsonb_build_object(
      'id', v_member.id, 'user_id', v_member.user_id, 'display_name', v_member.display_name, 'job_title', v_member.job_title,
      'is_owner', v_member.is_owner, 'primary_app', v_member.primary_app,
      'must_change_password', v_member.must_change_password),
    'modules', (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from (
        select m.module::text as x from public.tenant_modules m where m.tenant_id = v_tenant.id
        union select 'gestao') s),
    'permissions', v_perms,
    'process_ownership', coalesce((select jsonb_object_agg(po.process, po.owner) from public.process_ownership po where po.tenant_id = v_tenant.id), '{}'::jsonb)
  );
end $$;

-- Estabelecimentos do usuário (Portal do Assinante e redirecionamentos)
create or replace function public.my_tenants()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'slug', t.slug, 'name', t.name, 'status', t.status, 'is_owner', m.is_owner,
    'onboarding_completed_at', t.onboarding_completed_at, 'subscription_id', t.billing_subscription_id,
    'plan_code', t.plan_code, 'license_valid_until', t.license_valid_until
  ) order by t.name), '[]'::jsonb)
  from public.memberships m join public.tenants t on t.id = m.tenant_id
  where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

-- ---------------------------------------------------------------------------
-- Administração de equipe, funções e delegações
-- ---------------------------------------------------------------------------
create or replace function private.assert_can_delegate_set(
  p_tenant uuid, p_codes text[], p_limits jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
  v_own bigint;
  v_req bigint;
begin
  foreach v_code in array coalesce(p_codes, '{}') loop
    if not private.can_delegate((select auth.uid()), p_tenant, v_code) then
      perform private.fail('DELEGATION_DENIED', 'Você não pode delegar a permissão "' || v_code || '".');
    end if;
    v_own := private.direct_limit((select auth.uid()), p_tenant, v_code);
    v_req := nullif(p_limits ->> v_code, '')::bigint;
    if v_own is not null and (v_req is null or v_req > v_own) then
      perform private.fail('LIMIT_EXCEEDED', 'O limite concedido não pode ser maior que o seu limite para "' || v_code || '".');
    end if;
  end loop;
end $$;

create or replace function public.role_save(
  p_tenant uuid, p_role_id uuid, p_name text, p_description text, p_permissions jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_role uuid := p_role_id;
  v_codes text[];
  v_limits jsonb;
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'gestao.permissoes.alterar');
  select array_agg(e ->> 'code'),
         coalesce(jsonb_object_agg(e ->> 'code', e -> 'limit_cents') filter (where nullif(e ->> 'limit_cents', '') is not null), '{}'::jsonb)
    into v_codes, v_limits
  from jsonb_array_elements(coalesce(p_permissions, '[]'::jsonb)) e;
  perform private.assert_can_delegate_set(p_tenant, v_codes, v_limits);

  -- Ninguém amplia a própria autoridade alterando uma função que possui
  if v_role is not null and not private.is_owner(p_tenant) and exists (
    select 1 from public.membership_roles mr join public.memberships m on m.id = mr.membership_id
    where mr.role_id = v_role and m.user_id = (select auth.uid())
  ) then
    perform private.fail('SELF_ESCALATION', 'Você não pode alterar uma função atribuída a você.');
  end if;

  if v_role is null then
    insert into public.roles (tenant_id, name, description) values (p_tenant, trim(p_name), coalesce(p_description, ''))
      returning id into v_role;
  else
    update public.roles set name = trim(p_name), description = coalesce(p_description, '')
      where id = v_role and tenant_id = p_tenant;
    if not found then
      perform private.fail('NOT_FOUND', 'Função não encontrada.');
    end if;
    delete from public.role_permissions where role_id = v_role;
  end if;

  insert into public.role_permissions (role_id, tenant_id, permission_code, mode, limit_cents, can_delegate)
  select v_role, p_tenant, e ->> 'code',
    coalesce(nullif(e ->> 'mode', ''), 'direct')::public.grant_mode,
    nullif(e ->> 'limit_cents', '')::bigint,
    coalesce((e ->> 'can_delegate')::boolean, false) and private.is_owner(p_tenant)
  from jsonb_array_elements(coalesce(p_permissions, '[]'::jsonb)) e;

  perform private.audit(p_tenant, 'gestao', 'role.saved', 'role', v_role::text,
    jsonb_build_object('name', p_name, 'permissions', p_permissions), v_approval);
  return v_role;
end $$;

create or replace function public.role_delete(p_tenant uuid, p_role_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'gestao.permissoes.alterar');
  if exists (select 1 from public.membership_roles where role_id = p_role_id) then
    perform private.fail('ROLE_IN_USE', 'Remova a função dos colaboradores antes de excluí-la.');
  end if;
  delete from public.roles where id = p_role_id and tenant_id = p_tenant;
  perform private.audit(p_tenant, 'gestao', 'role.deleted', 'role', p_role_id::text, '{}'::jsonb, v_approval);
end $$;

create or replace function public.member_update(
  p_tenant uuid, p_membership_id uuid, p_display_name text, p_job_title text,
  p_primary_app public.app_module, p_supervisor uuid, p_status public.membership_status
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_member public.memberships;
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'gestao.equipe.alterar');
  select * into v_member from public.memberships where id = p_membership_id and tenant_id = p_tenant for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Colaborador não encontrado.');
  end if;
  if v_member.is_owner and p_status <> 'active' then
    perform private.fail('OWNER_PROTECTED', 'O titular não pode ser suspenso.');
  end if;
  if v_member.user_id = (select auth.uid()) and p_status <> v_member.status then
    perform private.fail('SELF_ESCALATION', 'Você não pode alterar a própria situação.');
  end if;
  if p_supervisor = p_membership_id then
    perform private.fail('INVALID', 'Um colaborador não pode supervisionar a si mesmo.');
  end if;
  update public.memberships set
    display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
    job_title = p_job_title,
    primary_app = p_primary_app,
    supervisor_membership_id = p_supervisor,
    status = p_status
  where id = p_membership_id;
  perform private.audit(p_tenant, 'gestao', 'member.updated', 'membership', p_membership_id::text,
    jsonb_build_object('status', p_status, 'primary_app', p_primary_app, 'job_title', p_job_title), v_approval);
end $$;

create or replace function public.member_set_roles(p_tenant uuid, p_membership_id uuid, p_role_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_member public.memberships;
  v_codes text[];
  v_limits jsonb;
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'gestao.permissoes.alterar');
  select * into v_member from public.memberships where id = p_membership_id and tenant_id = p_tenant;
  if not found then
    perform private.fail('NOT_FOUND', 'Colaborador não encontrado.');
  end if;
  if v_member.user_id = (select auth.uid()) then
    perform private.fail('SELF_ESCALATION', 'Você não pode alterar as próprias funções.');
  end if;
  if v_member.is_owner then
    perform private.fail('OWNER_PROTECTED', 'O titular possui todas as permissões.');
  end if;
  -- Funções adicionadas precisam ser delegáveis pelo solicitante
  select array_agg(distinct rp.permission_code),
         coalesce(jsonb_object_agg(rp.permission_code, rp.limit_cents) filter (where rp.limit_cents is not null), '{}'::jsonb)
    into v_codes, v_limits
  from public.role_permissions rp
  where rp.role_id = any (coalesce(p_role_ids, '{}')) and rp.tenant_id = p_tenant
    and rp.role_id not in (select role_id from public.membership_roles where membership_id = p_membership_id);
  perform private.assert_can_delegate_set(p_tenant, v_codes, v_limits);

  delete from public.membership_roles where membership_id = p_membership_id and role_id <> all (coalesce(p_role_ids, '{}'));
  insert into public.membership_roles (membership_id, role_id, tenant_id, assigned_by)
    select p_membership_id, r.id, p_tenant, (select auth.uid()) from public.roles r
    where r.id = any (coalesce(p_role_ids, '{}')) and r.tenant_id = p_tenant
    on conflict do nothing;
  perform private.audit(p_tenant, 'gestao', 'member.roles_set', 'membership', p_membership_id::text,
    jsonb_build_object('roles', p_role_ids), v_approval);
end $$;

create or replace function public.member_grant(
  p_tenant uuid, p_membership_id uuid, p_code text, p_mode public.grant_mode,
  p_limit_cents bigint, p_can_delegate boolean, p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_member public.memberships;
  v_id uuid;
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'gestao.permissoes.alterar');
  select * into v_member from public.memberships where id = p_membership_id and tenant_id = p_tenant;
  if not found then
    perform private.fail('NOT_FOUND', 'Colaborador não encontrado.');
  end if;
  if v_member.user_id = (select auth.uid()) then
    perform private.fail('SELF_ESCALATION', 'Você não pode alterar as próprias permissões.');
  end if;
  if v_member.is_owner then
    perform private.fail('OWNER_PROTECTED', 'O titular possui todas as permissões.');
  end if;
  if p_mode <> 'deny' then
    perform private.assert_can_delegate_set(p_tenant, array[p_code],
      case when p_limit_cents is null then '{}'::jsonb else jsonb_build_object(p_code, p_limit_cents) end);
  end if;
  -- Somente o titular concede o poder de repassar
  if coalesce(p_can_delegate, false) and not private.is_owner(p_tenant) then
    perform private.fail('DELEGATION_DENIED', 'Somente o titular concede o poder de delegar.');
  end if;

  update public.member_permissions set revoked_at = now(), revoked_by = (select auth.uid())
    where membership_id = p_membership_id and permission_code = p_code and revoked_at is null;
  insert into public.member_permissions (tenant_id, membership_id, permission_code, mode, limit_cents, can_delegate, expires_at, granted_by)
    values (p_tenant, p_membership_id, p_code, p_mode, p_limit_cents, coalesce(p_can_delegate, false), p_expires_at, (select auth.uid()))
    returning id into v_id;
  perform private.audit(p_tenant, 'gestao', 'permission.granted', 'membership', p_membership_id::text,
    jsonb_build_object('code', p_code, 'mode', p_mode, 'limit_cents', p_limit_cents, 'can_delegate', p_can_delegate, 'expires_at', p_expires_at),
    v_approval);
  return v_id;
end $$;

create or replace function public.member_revoke(p_tenant uuid, p_grant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_grant public.member_permissions;
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'gestao.permissoes.alterar');
  select * into v_grant from public.member_permissions where id = p_grant_id and tenant_id = p_tenant and revoked_at is null for update;
  if not found then
    perform private.fail('NOT_FOUND', 'Permissão não encontrada.');
  end if;
  if not private.can_delegate((select auth.uid()), p_tenant, v_grant.permission_code) then
    perform private.fail('DELEGATION_DENIED', 'Você não tem autoridade sobre esta permissão.');
  end if;
  update public.member_permissions set revoked_at = now(), revoked_by = (select auth.uid()) where id = p_grant_id;
  perform private.audit(p_tenant, 'gestao', 'permission.revoked', 'membership', v_grant.membership_id::text,
    jsonb_build_object('code', v_grant.permission_code), v_approval);
end $$;

-- Informações do restaurante
create or replace function public.tenant_update_info(
  p_tenant uuid, p_name text, p_legal_name text, p_document text, p_phone text, p_email text,
  p_address jsonb, p_logo_path text, p_timezone text, p_business_day_start_hour smallint
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'gestao.restaurante.alterar');
  if p_timezone is not null and not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    perform private.fail('INVALID', 'Fuso horário inválido.');
  end if;
  update public.tenants set
    name = coalesce(nullif(trim(p_name), ''), name),
    legal_name = p_legal_name, document = p_document, phone = p_phone, email = p_email,
    address = coalesce(p_address, '{}'::jsonb), logo_path = coalesce(p_logo_path, logo_path),
    timezone = coalesce(p_timezone, timezone),
    business_day_start_hour = coalesce(p_business_day_start_hour, business_day_start_hour)
  where id = p_tenant;
  perform private.audit(p_tenant, 'gestao', 'tenant.info_updated', 'tenant', p_tenant::text,
    jsonb_build_object('name', p_name), v_approval);
end $$;

-- Configurações operacionais (lista fechada de chaves)
create or replace function public.tenant_update_settings(p_tenant uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_allowed text[] := array[
    'local_order_mode', 'local_order_confirmation', 'kitchen_delivers', 'kitchen_stages',
    'service_fee_percent', 'delivery_enabled', 'delivery_responsible', 'delivery_payment_on',
    'delivery_eta_minutes', 'delivery_whatsapp', 'publicity_responsible'];
  v_key text;
  v_settings jsonb;
  v_approval uuid;
begin
  for v_key in select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) loop
    if v_key <> all (v_allowed) then
      perform private.fail('INVALID', 'Configuração desconhecida: ' || v_key);
    end if;
  end loop;
  if p_patch ? 'local_order_mode' or p_patch ? 'local_order_confirmation' then
    v_approval := private.authorize(p_tenant, 'cardapio.configurar');
  elsif p_patch ? 'delivery_enabled' or p_patch ? 'delivery_responsible' or p_patch ? 'delivery_payment_on' then
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
  update public.tenants set settings = settings || p_patch where id = p_tenant returning settings into v_settings;
  perform private.audit(p_tenant, 'gestao', 'tenant.settings_updated', 'tenant', p_tenant::text, p_patch, v_approval);
  return v_settings;
end $$;

-- ERP externo: apenas responsabilidade operacional, sem integração técnica.
create or replace function public.process_ownership_set(
  p_tenant uuid, p_process text, p_owner text, p_external_system text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'gestao.operacao.alterar');
  if p_owner not in ('interno', 'externo') then
    perform private.fail('INVALID', 'Responsável inválido.');
  end if;
  insert into public.process_ownership (tenant_id, process, owner, external_system, updated_by, updated_at)
  values (p_tenant, p_process, p_owner, nullif(trim(coalesce(p_external_system, '')), ''), (select auth.uid()), now())
  on conflict (tenant_id, process) do update
    set owner = excluded.owner, external_system = excluded.external_system,
        updated_by = excluded.updated_by, updated_at = now();
  perform private.audit(p_tenant, 'gestao', 'process.ownership_set', 'process', p_process,
    jsonb_build_object('owner', p_owner, 'external_system', p_external_system), v_approval);
end $$;

create or replace function private.process_internal(p_tenant uuid, p_process text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select owner = 'interno' from public.process_ownership where tenant_id = p_tenant and process = p_process), true)
$$;

-- Marca que o usuário trocou a senha temporária
create or replace function public.member_password_changed(p_tenant uuid)
returns void language sql security definer set search_path = '' as $$
  update public.memberships set must_change_password = false
  where tenant_id = p_tenant and user_id = (select auth.uid());
$$;
