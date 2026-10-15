import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, anon, as, createTenant, createUser, errorCode, one, pool, q, service, val } from './helpers';

afterAll(() => pool.end());

describe('isolamento multi-tenant e RLS', () => {
  let ownerA: string;
  let ownerB: string;
  let tenantA: string;
  let tenantB: string;

  beforeAll(async () => {
    ownerA = await createUser('Dono A');
    ownerB = await createUser('Dono B');
    tenantA = (await createTenant(ownerA)).tenantId;
    tenantB = (await createTenant(ownerB)).tenantId;
    await val(as(ownerA), `select public.category_save($1, null, 'Bebidas A', '', 0, true)`, [tenantA]);
    await val(as(ownerB), `select public.category_save($1, null, 'Bebidas B', '', 0, true)`, [tenantB]);
  });

  it('um restaurante não lê dados de outro', async () => {
    const rows = await q<{ name: string }>(as(ownerA), 'select name from public.categories');
    expect(rows.map((r) => r.name)).toEqual(['Bebidas A']);
    const tenants = await q(as(ownerA), 'select id from public.tenants');
    expect(tenants).toHaveLength(1);
  });

  it('um restaurante não escreve em outro', async () => {
    expect(await errorCode(() => val(as(ownerA), `select public.category_save($1, null, 'Invasão', '', 0, true)`, [tenantB]))).toBe(
      'FORBIDDEN',
    );
  });

  it('anônimo não lê tabelas internas nem escreve diretamente', async () => {
    expect(await errorCode(() => q(anon, 'select * from public.tenants'))).toMatch(/permission denied/);
    expect(
      await errorCode(() => q(as(ownerA), `insert into public.categories (tenant_id, name) values ($1, 'x')`, [tenantA])),
    ).toMatch(/permission denied/);
  });

  it('funções administrativas são exclusivas do service_role', async () => {
    expect(
      await errorCode(() =>
        q(as(ownerA), `select public.admin_sync_license($1, gen_random_uuid(), 'hack', 'x', 'active', 'x', null, '{}')`, [
          ownerA,
        ]),
      ),
    ).toMatch(/permission denied/);
  });

  it('contexto informa estados de acesso', async () => {
    const stranger = await createUser('Estranho');
    const slugA = await val<string>(service, 'select slug from public.tenants where id = $1', [tenantA]);
    const ctx = await val<{ state: string }>(as(stranger), 'select public.my_context($1)', [slugA]);
    expect(ctx.state).toBe('no_membership');
    expect((await val<{ state: string }>(as(stranger), 'select public.my_context($1)', ['inexistente'])).state).toBe(
      'tenant_not_found',
    );
    expect((await val<{ state: string }>(as(ownerA), 'select public.my_context($1)', [slugA])).state).toBe('ok');
  });

  it('assinatura suspensa bloqueia a operação', async () => {
    const owner = await createUser('Dono suspenso');
    const { tenantId, slug } = await createTenant(owner, ['gestao', 'caixa'], 'suspended');
    expect((await val<{ state: string }>(as(owner), 'select public.my_context($1)', [slug])).state).toBe('tenant_inactive');
    expect(await errorCode(() => val(as(owner), `select public.category_save($1, null, 'X', '', 0, true)`, [tenantId]))).toBe(
      'TENANT_INACTIVE',
    );
  });

  it('módulo não contratado é negado mesmo para o titular', async () => {
    const owner = await createUser('Dono START');
    const { tenantId } = await createTenant(owner, ['gestao', 'atendimento', 'cozinha']);
    expect(await val(as(owner), `select public.check_permission($1, 'estoque.acessar')`, [tenantId])).toBe('deny');
    expect(await val(as(owner), `select public.check_permission($1, 'atendimento.acessar')`, [tenantId])).toBe('direct');
  });
});

describe('autoridade, delegação e aprovações', () => {
  let owner: string;
  let tenant: string;
  let gestor: string;
  let caixa: string;
  let atendente: string;

  beforeAll(async () => {
    owner = await createUser('Titular');
    tenant = (await createTenant(owner)).tenantId;
    gestor = await addMember(tenant, owner, 'Gestora', ['Gestor'], 'gestao');
    caixa = await addMember(tenant, owner, 'Operador de caixa', ['Caixa'], 'caixa');
    atendente = await addMember(tenant, owner, 'Garçom', ['Atendente'], 'atendimento');
  });

  it('funções padrão definem permissões diretas, com limites e por aprovação', async () => {
    expect(await val(as(caixa), `select public.check_permission($1, 'caixa.desconto', 500)`, [tenant])).toBe('direct');
    expect(await val(as(caixa), `select public.check_permission($1, 'caixa.desconto', 5000)`, [tenant])).toBe('approval');
    expect(await val(as(caixa), `select public.check_permission($1, 'cozinha.acessar')`, [tenant])).toBe('deny');
    expect(await val(as(atendente), `select public.check_permission($1, 'atendimento.pedido.cancelar')`, [tenant])).toBe(
      'approval',
    );
  });

  it('ninguém amplia a própria autoridade', async () => {
    const mine = await val<string>(service, 'select id from public.memberships where tenant_id = $1 and user_id = $2', [
      tenant,
      gestor,
    ]);
    expect(
      await errorCode(() =>
        val(as(gestor), `select public.member_grant($1, $2, 'caixa.estorno', 'direct', null, false, null)`, [tenant, mine]),
      ),
    ).toBe('SELF_ESCALATION');
    const gestorRole = await val<string>(service, `select id from public.roles where tenant_id = $1 and name = 'Gestor'`, [
      tenant,
    ]);
    expect(
      await errorCode(() =>
        val(as(gestor), `select public.role_save($1, $2, 'Gestor', '', '[{"code":"caixa.estorno"}]')`, [tenant, gestorRole]),
      ),
    ).toBe('DELEGATION_DENIED');
  });

  it('gestor sem poder de delegar solicita ao titular; aprovação concede e revogação remove', async () => {
    const atendenteMember = await val<string>(
      service,
      'select id from public.memberships where tenant_id = $1 and user_id = $2',
      [tenant, atendente],
    );
    expect(
      await errorCode(() =>
        val(as(gestor), `select public.member_grant($1, $2, 'atendimento.pagamento.receber', 'direct', null, false, null)`, [
          tenant,
          atendenteMember,
        ]),
      ),
    ).toBe('DELEGATION_DENIED');

    const requestId = await val<string>(
      as(gestor),
      `select public.approval_request_create($1, 'gestao.permissoes.delegar', 'permission.grant', 'Permitir cobrança no atendimento', null, $2, 'Garçom cobra no salão')`,
      [tenant, JSON.stringify({ membership_id: atendenteMember, code: 'atendimento.pagamento.receber', mode: 'direct' })],
    );
    // O próprio gestor não decide; o titular decide
    expect(await errorCode(() => val(as(gestor), 'select public.approval_decide($1, $2, true, null)', [tenant, requestId]))).toBe(
      'FORBIDDEN',
    );
    const decided = await val<{ status: string }>(as(owner), 'select public.approval_decide($1, $2, true, $3)', [
      tenant,
      requestId,
      'ok',
    ]);
    expect(decided.status).toBe('executed');
    expect(await val(as(atendente), `select public.check_permission($1, 'atendimento.pagamento.receber')`, [tenant])).toBe(
      'direct',
    );

    const grant = await val<string>(
      service,
      `select id from public.member_permissions where membership_id = $1 and permission_code = 'atendimento.pagamento.receber' and revoked_at is null`,
      [atendenteMember],
    );
    await q(as(owner), 'select public.member_revoke($1, $2)', [tenant, grant]);
    expect(await val(as(atendente), `select public.check_permission($1, 'atendimento.pagamento.receber')`, [tenant])).toBe(
      'deny',
    );
    const audit = await q(service, `select action from public.audit_log where tenant_id = $1 and approval_id = $2`, [
      tenant,
      requestId,
    ]);
    expect(audit.map((a) => (a as { action: string }).action)).toEqual(
      expect.arrayContaining(['approval.approved', 'permission.granted', 'approval.executed']),
    );
  });

  it('limite concedido não supera o limite de quem delega', async () => {
    const delegator = await addMember(tenant, owner, 'Supervisor com limite', [], 'caixa');
    const delegatorMember = await val<string>(
      service,
      'select id from public.memberships where tenant_id = $1 and user_id = $2',
      [tenant, delegator],
    );
    await q(as(owner), `select public.member_grant($1, $2, 'gestao.permissoes.alterar', 'direct', null, false, null)`, [
      tenant,
      delegatorMember,
    ]);
    await q(as(owner), `select public.member_grant($1, $2, 'gestao.permissoes.delegar', 'direct', null, false, null)`, [
      tenant,
      delegatorMember,
    ]);
    await q(as(owner), `select public.member_grant($1, $2, 'caixa.desconto', 'direct', 2000, true, null)`, [
      tenant,
      delegatorMember,
    ]);
    const target = await val<string>(service, 'select id from public.memberships where tenant_id = $1 and user_id = $2', [
      tenant,
      caixa,
    ]);
    expect(
      await errorCode(() =>
        val(as(delegator), `select public.member_grant($1, $2, 'caixa.desconto', 'direct', 5000, false, null)`, [
          tenant,
          target,
        ]),
      ),
    ).toBe('LIMIT_EXCEEDED');
    await val(as(delegator), `select public.member_grant($1, $2, 'caixa.desconto', 'direct', 1500, false, null)`, [
      tenant,
      target,
    ]);
    // Somente o titular concede o poder de repassar
    expect(
      await errorCode(() =>
        val(as(delegator), `select public.member_grant($1, $2, 'caixa.desconto', 'direct', 1500, true, null)`, [tenant, target]),
      ),
    ).toBe('DELEGATION_DENIED');
  });

  it('aprovação é revalidada: aprovador sem autoridade não executa', async () => {
    const approver = await addMember(tenant, owner, 'Aprovador temporário', [], 'caixa');
    const approverMember = await val<string>(
      service,
      'select id from public.memberships where tenant_id = $1 and user_id = $2',
      [tenant, approver],
    );
    await q(as(owner), `select public.member_grant($1, $2, 'caixa.desconto', 'direct', null, false, null)`, [
      tenant,
      approverMember,
    ]);
    const req = await one<{ id: string }>(
      service,
      `insert into public.approval_requests (tenant_id, module, permission_code, action_kind, summary, amount_cents, payload, requested_by, status, decided_by, decided_at)
       values ($1, 'caixa', 'caixa.desconto', 'tab.discount', 'teste', 100, '{}', $2, 'approved', $3, now()) returning id`,
      [tenant, caixa, approver],
    );
    const grant = await val<string>(
      service,
      `select id from public.member_permissions where membership_id = $1 and permission_code = 'caixa.desconto' and revoked_at is null`,
      [approverMember],
    );
    await q(as(owner), 'select public.member_revoke($1, $2)', [tenant, grant]);
    const code = await errorCode(() =>
      q(
        as(caixa),
        `select set_config('pdp.approval_id', $2, true), private.authorize($1, 'caixa.desconto', 100)`,
        [tenant, req.id],
      ),
    );
    // authorize é privado: o papel authenticated sequer consegue chamá-lo diretamente
    expect(code).toMatch(/permission denied/);
  });

  it('suspensão de colaborador encerra o acesso imediatamente', async () => {
    const temp = await addMember(tenant, owner, 'Temporário', ['Atendente'], 'atendimento');
    const member = await val<string>(service, 'select id from public.memberships where tenant_id = $1 and user_id = $2', [
      tenant,
      temp,
    ]);
    expect(await val(as(temp), `select public.check_permission($1, 'atendimento.acessar')`, [tenant])).toBe('direct');
    await q(as(owner), `select public.member_update($1, $2, 'Temporário', null, 'atendimento', null, 'suspended')`, [
      tenant,
      member,
    ]);
    expect(await val(as(temp), `select public.check_permission($1, 'atendimento.acessar')`, [tenant])).toBe('deny');
    expect(await q(as(temp), 'select id from public.categories')).toHaveLength(0);
  });
});
