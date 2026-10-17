import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, as, createTenant, createUser, errorCode, key, pool, q, service, val } from './helpers';

afterAll(() => pool.end());

describe('estoque', () => {
  let owner: string;
  let tenant: string;
  let estoquista: string;
  let material: string;
  let deposito: string;
  let camara: string;

  beforeAll(async () => {
    owner = await createUser('Titular Estoque');
    tenant = (await createTenant(owner)).tenantId;
    estoquista = await addMember(tenant, owner, 'Estoquista', ['Estoquista'], 'estoque');
    deposito = await val<string>(
      as(estoquista),
      `select public.stock_location_save($1, null, 'Depósito', 'deposito', null, true)`,
      [tenant],
    );
    camara = await val<string>(
      as(estoquista),
      `select public.stock_location_save($1, null, 'Câmara fria', 'camara_fria', null, true)`,
      [tenant],
    );
    material = await val<string>(
      as(estoquista),
      `select public.material_save($1, null, 'Mussarela', 'Laticínios', 'kg', null, 5, 10, true, true)`,
      [tenant],
    );
  });

  it('perecível exige validade; material vencido não é liberado', async () => {
    expect(
      await errorCode(() =>
        q(as(estoquista), `select public.stock_entry($1, $2, $3, 10, 'L1', null, 3000, 'compra', $4)`, [
          tenant,
          material,
          camara,
          key(),
        ]),
      ),
    ).toBe('EXPIRY_REQUIRED');
    const expired = await val<string>(
      as(estoquista),
      `select public.stock_entry($1, $2, $3, 4, 'L0', current_date - 1, 3000, 'compra', $4)`,
      [tenant, material, camara, key()],
    );
    expect(
      await errorCode(() =>
        q(as(estoquista), `select public.stock_out($1, $2, 'saida', 1, 'uso', $3)`, [tenant, expired, key()]),
      ),
    ).toBe('LOT_EXPIRED');
    expect(
      await errorCode(() =>
        q(as(estoquista), `select public.stock_transfer($1, $2, $3, 1, 'x', $4)`, [tenant, expired, deposito, key()]),
      ),
    ).toBe('LOT_EXPIRED');
    // Descarte de vencido é permitido (dentro do limite da função)
    await q(as(estoquista), `select public.stock_out($1, $2, 'descarte', 1, 'vencido', $3)`, [tenant, expired, key()]);
  });

  it('lote bloqueado não é liberado; transferência mantém rastreabilidade', async () => {
    const lot = await val<string>(
      as(estoquista),
      `select public.stock_entry($1, $2, $3, 10, 'L2', current_date + 20, 3000, 'compra', $4)`,
      [tenant, material, deposito, key()],
    );
    const moved = await val<string>(as(estoquista), `select public.stock_transfer($1, $2, $3, 4, 'abastecer', $4)`, [
      tenant,
      lot,
      camara,
      key(),
    ]);
    expect(moved).not.toBe(lot);
    const movements = await q<{ kind: string; qty: string }>(
      service,
      `select kind, qty from public.stock_movements where lot_id = $1 order by created_at`,
      [lot],
    );
    expect(movements.map((m) => m.kind)).toEqual(['entrada', 'transferencia']);
    await q(as(owner), `select public.stock_lot_block($1, $2, true, 'avaria')`, [tenant, moved]);
    expect(
      await errorCode(() => q(as(estoquista), `select public.stock_out($1, $2, 'saida', 1, 'uso', $3)`, [tenant, moved, key()])),
    ).toBe('LOT_BLOCKED');
  });

  it('ajuste exige aprovação para o estoquista; inventário divergente gera ajuste', async () => {
    const lot = await val<string>(
      service,
      `select id from public.stock_lots where tenant_id = $1 and lot_code = 'L2' and location_id = $2`,
      [tenant, deposito],
    );
    expect(
      await errorCode(() =>
        q(as(estoquista), `select public.stock_out($1, $2, 'ajuste', -1, 'quebra', $3)`, [tenant, lot, key()]),
      ),
    ).toBe('APPROVAL_REQUIRED');
    const count = await val<string>(as(estoquista), 'select public.inventory_start($1, $2, null)', [tenant, deposito]);
    const lines = await q<{ id: string; expected_qty: string }>(
      service,
      'select id, expected_qty from public.inventory_count_lines where count_id = $1',
      [count],
    );
    for (const line of lines) {
      await q(as(estoquista), 'select public.inventory_count_line($1, $2, $3)', [tenant, line.id, Number(line.expected_qty) - 1]);
    }
    // Estoquista não pode ajustar diretamente: precisa de aprovação
    expect(await errorCode(() => q(as(estoquista), 'select public.inventory_close($1, $2)', [tenant, count]))).toBe(
      'APPROVAL_REQUIRED',
    );
    const req = await val<string>(
      as(estoquista),
      `select public.approval_request_create($1, 'estoque.ajuste.registrar', 'inventory.close', 'Fechar inventário', null, $2, null)`,
      [tenant, JSON.stringify({ count_id: count })],
    );
    const decided = await val<{ status: string; error: string | null }>(
      as(owner),
      'select public.approval_decide($1, $2, true, null)',
      [tenant, req],
    );
    expect(decided.error).toBeNull();
    expect(decided.status).toBe('executed');
    expect(await val(service, 'select status from public.inventory_counts where id = $1', [count])).toBe('closed');
  });

  it('solicitação de material: atende por FEFO ou gera compra', async () => {
    const cozinheiro = await addMember(tenant, owner, 'Cozinha', ['Cozinha'], 'cozinha');
    await q(
      as(owner),
      `select public.member_grant($1, (select id from public.memberships where tenant_id = $1 and user_id = $2), 'estoque.solicitacao.criar', 'direct', null, false, null)`,
      [tenant, cozinheiro],
    );
    const lotA = await val<string>(
      as(estoquista),
      `select public.stock_entry($1, $2, $3, 3, 'LA', current_date + 3, 3000, 'compra', $4)`,
      [tenant, material, camara, key()],
    );
    const req = await val<string>(as(cozinheiro), 'select public.material_request_create($1, null, $2, null, null)', [
      tenant,
      JSON.stringify([{ material_id: material, quantity: 2 }]),
    ]);
    const result = await val<{ fulfilled: boolean }>(as(estoquista), 'select public.material_request_fulfill($1, $2)', [
      tenant,
      req,
    ]);
    expect(result.fulfilled).toBe(true);
    // FEFO: saiu do lote que vence primeiro
    expect(Number(await val(service, 'select qty from public.stock_lots where id = $1', [lotA]))).toBe(1);

    const big = await val<string>(as(cozinheiro), 'select public.material_request_create($1, null, $2, null, null)', [
      tenant,
      JSON.stringify([{ material_id: material, quantity: 500 }]),
    ]);
    const missing = await val<{ fulfilled: boolean; missing: unknown[] }>(
      as(estoquista),
      'select public.material_request_fulfill($1, $2)',
      [tenant, big],
    );
    expect(missing.fulfilled).toBe(false);
    const pr = await val<string>(as(estoquista), `select public.material_request_to_purchase($1, $2, null)`, [tenant, big]);
    expect(await val(service, 'select status from public.purchase_requests where id = $1', [pr])).toBe('requested');
  });
});

describe('compras, contas e ERP externo', () => {
  let owner: string;
  let tenant: string;
  let adm: string;
  let material: string;
  let local: string;

  beforeAll(async () => {
    owner = await createUser('Titular Financeiro');
    tenant = (await createTenant(owner)).tenantId;
    adm = await addMember(tenant, owner, 'Administrativo', ['Administrativo'], 'financeiro');
    local = await val<string>(as(owner), `select public.stock_location_save($1, null, 'Depósito', 'deposito', null, true)`, [
      tenant,
    ]);
    material = await val<string>(
      as(owner),
      `select public.material_save($1, null, 'Farinha', 'Secos', 'kg', null, 10, 25, false, true)`,
      [tenant],
    );
  });

  it('solicitação → cotação → aprovação → pedido → recebimento → estoque e contas a pagar', async () => {
    const supplier = await val<string>(
      as(adm),
      `select public.supplier_save($1, null, 'Moinho Bom', null, null, null, null, null, true)`,
      [tenant],
    );
    const pr = await val<string>(as(adm), 'select public.purchase_request_create($1, $2, null, $3)', [
      tenant,
      'Reposição semanal',
      JSON.stringify([{ material_id: material, quantity: 25 }]),
    ]);
    const quote = await val<string>(as(adm), 'select public.quotation_add($1, $2, $3, 12500, 2, null, null, null, null)', [
      tenant,
      pr,
      supplier,
    ]);
    // Administrativo precisa de aprovação para aprovar a compra; e não aprova a própria solicitação
    expect(await errorCode(() => q(as(adm), 'select public.purchase_decide($1, $2, $3, true, null)', [tenant, pr, quote]))).toBe(
      'APPROVAL_REQUIRED',
    );
    await q(as(owner), 'select public.purchase_decide($1, $2, $3, true, $4)', [tenant, pr, quote, 'ok']);
    const po = await val<string>(as(adm), 'select public.purchase_order_issue($1, $2, null, 15, $3)', [
      tenant,
      pr,
      JSON.stringify([{ material_id: material, description: 'Farinha', quantity: 25, unit: 'kg', unit_price_cents: 500 }]),
    ]);
    const poItem = await val<string>(service, 'select id from public.purchase_order_items where order_id = $1', [po]);
    expect(
      await errorCode(() =>
        q(as(adm), 'select public.goods_receipt_register($1, $2, $3, null, null, null, $4)', [
          tenant,
          po,
          JSON.stringify([{ po_item_id: poItem, quantity: 30, location_id: local }]),
          key(),
        ]),
      ),
    ).toBe('OVER_RECEIPT');
    await q(as(adm), 'select public.goods_receipt_register($1, $2, $3, $4, null, null, $5)', [
      tenant,
      po,
      JSON.stringify([{ po_item_id: poItem, quantity: 25, location_id: local }]),
      'NF 123',
      key(),
    ]);
    const overview = await val<{ name: string; available_qty: number }[]>(as(owner), 'select public.stock_overview($1)', [
      tenant,
    ]);
    expect(Number(overview.find((m) => m.name === 'Farinha')!.available_qty)).toBe(25);
    const payable = await val<{ id: string; amount_cents: number; status: string }>(
      service,
      `select to_jsonb(p) from public.payables p where purchase_order_id = $1`,
      [po],
    );
    expect(Number(payable.amount_cents)).toBe(12500);
    await q(as(adm), `select public.payable_pay($1, $2, 'pix', null)`, [tenant, payable.id]);
    // A data financeira segue o fuso do restaurante, não o UTC da conexão de teste.
    const flow = await val<{ out_cents: number }[]>(
      as(owner),
      `select public.cash_flow($1, (now() at time zone timezone)::date, (now() at time zone timezone)::date)
       from public.tenants where id = $1`,
      [tenant],
    );
    expect(flow[0]!.out_cents).toBe(12500);
  });

  it('ERP externo: Ponto do Pedido não exige estoque nem contas a pagar e não bloqueia a operação', async () => {
    await q(as(owner), `select public.process_ownership_set($1, 'estoque', 'externo', 'ERP do restaurante')`, [tenant]);
    await q(as(owner), `select public.process_ownership_set($1, 'contas_pagar', 'externo', 'ERP do restaurante')`, [tenant]);
    expect(
      await errorCode(() =>
        q(as(owner), `select public.stock_entry($1, $2, $3, 1, null, null, null, 'x', $4)`, [tenant, material, local, key()]),
      ),
    ).toBe('PROCESS_EXTERNAL');
    expect(
      await errorCode(() =>
        q(as(adm), `select public.payable_create($1, 'conta', null, 'Luz', 'Utilidades', 1000, current_date, null, $2)`, [
          tenant,
          key(),
        ]),
      ),
    ).toBe('PROCESS_EXTERNAL');

    // Compras continuam internas: o recebimento não gera estoque nem conta a pagar
    const supplier = await val<string>(
      as(adm),
      `select public.supplier_save($1, null, 'Distribuidora', null, null, null, null, null, true)`,
      [tenant],
    );
    const pr = await val<string>(as(adm), 'select public.purchase_request_create($1, $2, null, $3)', [
      tenant,
      'Bebidas',
      JSON.stringify([{ material_id: material, quantity: 5 }]),
    ]);
    const quote = await val<string>(as(adm), 'select public.quotation_add($1, $2, $3, 1000, 1, null, null, null, null)', [
      tenant,
      pr,
      supplier,
    ]);
    await q(as(owner), 'select public.purchase_decide($1, $2, $3, true, null)', [tenant, pr, quote]);
    const po = await val<string>(as(adm), 'select public.purchase_order_issue($1, $2, null, 0, null)', [tenant, pr]);
    const poItem = await val<string>(service, 'select id from public.purchase_order_items where order_id = $1', [po]);
    await q(as(adm), 'select public.goods_receipt_register($1, $2, $3, null, null, null, $4)', [
      tenant,
      po,
      JSON.stringify([{ po_item_id: poItem, quantity: 5 }]),
      key(),
    ]);
    expect(await val<number>(service, 'select count(*)::int from public.payables where purchase_order_id = $1', [po])).toBe(0);
    expect(
      await val<number>(
        service,
        `select count(*)::int from public.stock_movements where ref_type = 'goods_receipt' and tenant_id = $1 and created_at > now() - interval '5 seconds' and material_id = $2 and qty = 5`,
        [tenant, material],
      ),
    ).toBe(0);

    // A operação de salão não depende do ERP
    const ctx = await val<{ process_ownership: Record<string, string> }>(
      as(owner),
      'select public.my_context((select slug from public.tenants where id = $1))',
      [tenant],
    );
    expect(ctx.process_ownership.estoque).toBe('externo');
    const cat = await val<string>(as(owner), `select public.category_save($1, null, 'Pratos', '', 0, true)`, [tenant]);
    expect(cat).toBeTruthy();
  });

  it('reembolso: solicitante não aprova o próprio pedido', async () => {
    const id = await val<string>(
      as(adm),
      `select public.reimbursement_request($1, 'Táxi', 'Transporte', 3500, current_date, null)`,
      [tenant],
    );
    expect(await errorCode(() => q(as(adm), 'select public.reimbursement_decide($1, $2, true, null)', [tenant, id]))).toBe(
      'FORBIDDEN',
    );
    await q(as(owner), 'select public.reimbursement_decide($1, $2, true, null)', [tenant, id]);
    expect(await val(service, 'select status from public.reimbursements where id = $1', [id])).toBe('approved');
  });
});

describe('indicadores e primeiro acesso', () => {
  it('KPIs respeitam permissão e trazem pendências reais', async () => {
    const owner = await createUser('Titular KPI');
    const { tenantId: tenant } = await createTenant(owner);
    const garcom = await addMember(tenant, owner, 'Garçom', ['Atendente'], 'atendimento');
    expect(await errorCode(() => q(as(garcom), 'select public.management_kpis($1, current_date, current_date)', [tenant]))).toBe(
      'FORBIDDEN',
    );
    const kpi = await val<{ revenue_cents: number; pending: { open_tabs: number } }>(
      as(owner),
      'select public.management_kpis($1, current_date - 7, current_date)',
      [tenant],
    );
    expect(kpi.revenue_cents).toBe(0);
    expect(kpi.pending.open_tabs).toBe(0);

    const state = await val<{ detected: Record<string, boolean>; completed_at: string | null }>(
      as(owner),
      'select public.onboarding_state($1)',
      [tenant],
    );
    expect(state.detected.equipe).toBe(true);
    expect(state.detected.cardapio).toBe(false);
    await q(as(owner), `select public.onboarding_mark($1, 'boas_vindas', 'done')`, [tenant]);
    await q(as(owner), 'select public.onboarding_finish($1)', [tenant]);
    expect(
      (await val<{ completed_at: string | null }>(as(owner), 'select public.onboarding_state($1)', [tenant])).completed_at,
    ).not.toBeNull();
  });

  it('preferências visuais são individuais por usuário, restaurante e aplicativo', async () => {
    const owner = await createUser('Titular UI');
    const { tenantId: tenant } = await createTenant(owner);
    const other = await addMember(tenant, owner, 'Outro', ['Caixa'], 'caixa');
    await q(
      as(owner),
      `insert into public.ui_preferences (user_id, tenant_id, app, model, scheme) values ($1, $2, 'caixa', 'm2', 'dark')`,
      [owner, tenant],
    );
    await q(as(other), `insert into public.ui_preferences (user_id, tenant_id, app, model) values ($1, $2, 'caixa', 'm3')`, [
      other,
      tenant,
    ]);
    expect(await q(as(other), 'select model from public.ui_preferences')).toEqual([{ model: 'm3' }]);
    expect(
      await errorCode(() =>
        q(as(other), `insert into public.ui_preferences (user_id, tenant_id, app, model) values ($1, $2, 'gestao', 'm1')`, [
          owner,
          tenant,
        ]),
      ),
    ).toMatch(/row-level security/);
    expect(
      await errorCode(() =>
        q(as(other), `insert into public.ui_preferences (user_id, tenant_id, app, model) values ($1, $2, 'caixa', 'm9')`, [
          other,
          tenant,
        ]),
      ),
    ).toMatch(/check constraint|violates/);
  });
});
