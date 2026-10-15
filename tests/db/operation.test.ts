import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addMember,
  anon,
  as,
  createTenant,
  createUser,
  errorCode,
  key,
  pool,
  q,
  seedOperation,
  service,
  val,
} from './helpers';

afterAll(() => pool.end());

type Tab = {
  id: string;
  status: string;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  table_id: string | null;
  has_pending_orders: boolean;
};

describe('fluxo Atendimento → Cozinha → Caixa', () => {
  let owner: string;
  let tenant: string;
  let garcom: string;
  let cozinheiro: string;
  let operador: string;
  let s: Awaited<ReturnType<typeof seedOperation>>;

  beforeAll(async () => {
    owner = await createUser('Titular');
    tenant = (await createTenant(owner)).tenantId;
    s = await seedOperation(tenant, owner);
    garcom = await addMember(tenant, owner, 'Garçom', ['Atendente'], 'atendimento');
    cozinheiro = await addMember(tenant, owner, 'Cozinheiro', ['Cozinha'], 'cozinha');
    operador = await addMember(tenant, owner, 'Operador', ['Caixa'], 'caixa');
  });

  it('comanda completa: pedido, preparo, entrega, pagamento, quitação e mesa liberada', async () => {
    const tab = await val<Tab>(as(garcom), 'select public.tab_open($1, $2, null, 2::smallint, $3)', [tenant, s.table1, key()]);
    expect(tab.status).toBe('open');

    // Abrir de novo a mesma mesa localiza a comanda existente
    const again = await val<Tab>(as(garcom), 'select public.tab_open($1, $2, null, 2::smallint, $3)', [tenant, s.table1, key()]);
    expect(again.id).toBe(tab.id);

    const items = JSON.stringify([
      { product_id: s.pizza, quantity: 1, notes: 'sem cebola' },
      { product_id: s.soda, quantity: 2 },
    ]);
    const orderKey = key();
    const created = await val<{ order: { id: string }; tab: Tab; duplicate: boolean }>(
      as(garcom),
      'select public.order_create($1, $2, $3, null, $4)',
      [tenant, tab.id, items, orderKey],
    );
    expect(created.tab.total_cents).toBe(4990 + 1400);
    // Repetição com a mesma chave não duplica o pedido
    const dup = await val<{ duplicate: boolean }>(as(garcom), 'select public.order_create($1, $2, $3, null, $4)', [
      tenant,
      tab.id,
      items,
      orderKey,
    ]);
    expect(dup.duplicate).toBe(true);
    expect(await val(service, 'select count(*)::int from public.orders where tab_id = $1', [tab.id])).toBe(1);

    const order = created.order.id;
    // Garçom não executa preparo
    expect(await errorCode(() => q(as(garcom), `select public.kitchen_advance($1, $2, 'preparing')`, [tenant, order]))).toBe(
      'FORBIDDEN',
    );
    await q(as(cozinheiro), `select public.kitchen_advance($1, $2, 'preparing', 'forno')`, [tenant, order]);
    // Entrega antes de ficar pronto é inválida
    expect(await errorCode(() => q(as(garcom), 'select public.order_deliver($1, $2)', [tenant, order]))).toBe('INVALID_STATE');
    await q(as(cozinheiro), `select public.kitchen_advance($1, $2, 'ready')`, [tenant, order]);
    await q(as(garcom), 'select public.order_deliver($1, $2)', [tenant, order]);

    // Caixa precisa estar aberto
    expect(
      await errorCode(() =>
        q(as(operador), `select public.payment_register($1, $2, $3, 1000, null, null, 'caixa', $4)`, [tenant, tab.id, s.pix, key()]),
      ),
    ).toBe('CASH_CLOSED');
    await q(as(operador), 'select public.cash_session_open($1, 10000, $2)', [tenant, key()]);

    // Pagamento acima do saldo é rejeitado
    expect(
      await errorCode(() =>
        q(as(operador), `select public.payment_register($1, $2, $3, 999999, null, null, 'caixa', $4)`, [
          tenant,
          tab.id,
          s.pix,
          key(),
        ]),
      ),
    ).toBe('OVERPAYMENT');

    // Pagamento parcial em Pix e restante em dinheiro com troco
    const partial = await val<{ tab: Tab; closed: boolean }>(
      as(operador),
      `select public.payment_register($1, $2, $3, 3000, null, 'Pessoa 1', 'caixa', $4)`,
      [tenant, tab.id, s.pix, key()],
    );
    expect(partial.closed).toBe(false);
    expect(partial.tab.balance_cents).toBe(3390);
    const final = await val<{ tab: Tab; closed: boolean; payment: { change_cents: number } }>(
      as(operador),
      `select public.payment_register($1, $2, $3, 3390, 5000, 'Pessoa 2', 'caixa', $4)`,
      [tenant, tab.id, s.cash, key()],
    );
    expect(final.payment.change_cents).toBe(1610);
    expect(final.closed).toBe(true);
    expect(final.tab.status).toBe('closed');

    // Mesa liberada: nova comanda é aberta na mesma mesa
    const next = await val<Tab>(as(garcom), 'select public.tab_open($1, $2, null, 2::smallint, $3)', [tenant, s.table1, key()]);
    expect(next.id).not.toBe(tab.id);
    // Comanda quitada não volta a ser cobrança pendente
    expect(
      await errorCode(() =>
        q(as(operador), `select public.payment_register($1, $2, $3, 100, null, null, 'caixa', $4)`, [tenant, tab.id, s.pix, key()]),
      ),
    ).toBe('TAB_CLOSED');
  });

  it('comanda quitada com pedido pendente não libera a mesa', async () => {
    const tab = await val<Tab>(as(garcom), 'select public.tab_open($1, $2, null, 2::smallint, $3)', [tenant, s.table2, key()]);
    await q(as(garcom), 'select public.order_create($1, $2, $3, null, $4)', [
      tenant,
      tab.id,
      JSON.stringify([{ product_id: s.soda, quantity: 1 }]),
      key(),
    ]);
    const paid = await val<{ tab: Tab; closed: boolean }>(
      as(operador),
      `select public.payment_register($1, $2, $3, 700, null, null, 'caixa', $4)`,
      [tenant, tab.id, s.pix, key()],
    );
    expect(paid.closed).toBe(false);
    expect(paid.tab.has_pending_orders).toBe(true);
    expect(await errorCode(() => q(as(garcom), 'select public.tab_close($1, $2)', [tenant, tab.id]))).toBe('PENDING_ORDERS');
    const order = await val<string>(service, 'select id from public.orders where tab_id = $1', [tab.id]);
    await q(as(cozinheiro), `select public.kitchen_advance($1, $2, 'preparing')`, [tenant, order]);
    await q(as(cozinheiro), `select public.kitchen_advance($1, $2, 'ready')`, [tenant, order]);
    const delivered = await val<Tab>(as(garcom), 'select public.order_deliver($1, $2)', [tenant, order]);
    expect(delivered.status).toBe('closed');
  });

  it('pagamentos simultâneos não duplicam receita', async () => {
    const tab = await val<Tab>(as(garcom), 'select public.tab_open($1, null, $2, null, $3)', [tenant, 'Balcão', key()]);
    await q(as(garcom), 'select public.order_create($1, $2, $3, null, $4)', [
      tenant,
      tab.id,
      JSON.stringify([{ product_id: s.pizza, quantity: 1 }]),
      key(),
    ]);
    const attempts = await Promise.allSettled(
      [1, 2, 3, 4].map(() =>
        q(as(operador), `select public.payment_register($1, $2, $3, 4990, null, null, 'caixa', $4)`, [
          tenant,
          tab.id,
          s.pix,
          key(),
        ]),
      ),
    );
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
    const paid = await val<number>(
      service,
      `select coalesce(sum(amount_cents), 0)::int from public.payments where tab_id = $1 and status = 'confirmed'`,
      [tab.id],
    );
    expect(paid).toBe(4990);
  });

  it('idempotência de pagamento: repetição retorna o mesmo registro', async () => {
    const tab = await val<Tab>(as(garcom), 'select public.tab_open($1, null, $2, null, $3)', [tenant, 'Balcão 2', key()]);
    await q(as(garcom), 'select public.order_create($1, $2, $3, null, $4)', [
      tenant,
      tab.id,
      JSON.stringify([{ product_id: s.soda, quantity: 2 }]),
      key(),
    ]);
    const k = key();
    const first = await val<{ duplicate: boolean }>(
      as(operador),
      `select public.payment_register($1, $2, $3, 700, null, null, 'caixa', $4)`,
      [tenant, tab.id, s.pix, k],
    );
    const second = await val<{ duplicate: boolean }>(
      as(operador),
      `select public.payment_register($1, $2, $3, 700, null, null, 'caixa', $4)`,
      [tenant, tab.id, s.pix, k],
    );
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(
      await errorCode(() =>
        q(as(operador), `select public.payment_register($1, $2, $3, 500, null, null, 'caixa', $4)`, [tenant, tab.id, s.pix, k]),
      ),
    ).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('cancelamento exige aprovação para o garçom e estorno quando já pago', async () => {
    const tab = await val<Tab>(as(garcom), 'select public.tab_open($1, null, $2, null, $3)', [tenant, 'Cancelamento', key()]);
    const created = await val<{ order: { id: string } }>(as(garcom), 'select public.order_create($1, $2, $3, null, $4)', [
      tenant,
      tab.id,
      JSON.stringify([{ product_id: s.pizza, quantity: 1 }]),
      key(),
    ]);
    expect(
      await errorCode(() => q(as(garcom), `select public.order_cancel($1, $2, 'cliente desistiu')`, [tenant, created.order.id])),
    ).toBe('APPROVAL_REQUIRED');

    const request = await val<string>(
      as(garcom),
      `select public.approval_request_create($1, 'atendimento.pedido.cancelar', 'order.cancel', 'Cancelar pedido', 4990, $2, 'cliente desistiu')`,
      [tenant, JSON.stringify({ order_id: created.order.id, reason: 'cliente desistiu' })],
    );
    const decided = await val<{ status: string }>(as(owner), 'select public.approval_decide($1, $2, true, null)', [
      tenant,
      request,
    ]);
    expect(decided.status).toBe('executed');
    expect(await val(service, 'select status::text from public.orders where id = $1', [created.order.id])).toBe('cancelled');

    // Pedido pago não pode ser cancelado sem estorno
    const tab2 = await val<Tab>(as(garcom), 'select public.tab_open($1, null, $2, null, $3)', [tenant, 'Pago', key()]);
    const o2 = await val<{ order: { id: string } }>(as(garcom), 'select public.order_create($1, $2, $3, null, $4)', [
      tenant,
      tab2.id,
      JSON.stringify([{ product_id: s.pizza, quantity: 1 }]),
      key(),
    ]);
    await q(as(operador), `select public.payment_register($1, $2, $3, 4990, null, null, 'caixa', $4)`, [
      tenant,
      tab2.id,
      s.pix,
      key(),
    ]);
    expect(await errorCode(() => q(as(owner), `select public.order_cancel($1, $2, 'erro')`, [tenant, o2.order.id]))).toBe(
      'REFUND_REQUIRED',
    );
  });

  it('desconto acima do limite exige aprovação; sangria aprovada é executada pelo operador', async () => {
    const tab = await val<Tab>(as(garcom), 'select public.tab_open($1, null, $2, null, $3)', [tenant, 'Desconto', key()]);
    await q(as(garcom), 'select public.order_create($1, $2, $3, null, $4)', [
      tenant,
      tab.id,
      JSON.stringify([{ product_id: s.pizza, quantity: 2 }]),
      key(),
    ]);
    await q(as(operador), `select public.tab_set_discount($1, $2, 500, 'cortesia')`, [tenant, tab.id]);
    expect(await errorCode(() => q(as(operador), `select public.tab_set_discount($1, $2, 3000, 'cortesia')`, [tenant, tab.id]))).toBe(
      'APPROVAL_REQUIRED',
    );

    const sangria = await val<string>(
      as(operador),
      `select public.approval_request_create($1, 'caixa.sangria', 'cash.sangria', 'Sangria', 90000, $2, 'excesso no caixa')`,
      [tenant, JSON.stringify({ amount_cents: 90000, reason: 'excesso no caixa' })],
    );
    const decided = await val<{ status: string }>(as(owner), 'select public.approval_decide($1, $2, true, null)', [
      tenant,
      sangria,
    ]);
    expect(decided.status).toBe('approved');
    // Só o solicitante executa; uma única vez
    expect(await errorCode(() => q(as(owner), 'select public.approval_execute($1, $2)', [tenant, sangria]))).toBe('FORBIDDEN');
    const exec = await val<{ status: string }>(as(operador), 'select public.approval_execute($1, $2)', [tenant, sangria]);
    expect(exec.status).toBe('executed');
    expect(await errorCode(() => q(as(operador), 'select public.approval_execute($1, $2)', [tenant, sangria]))).toBe(
      'INVALID_STATE',
    );
  });

  it('aprovação perde efeito quando o aprovador perde a autoridade antes da execução', async () => {
    const approver = await addMember(tenant, owner, 'Subgerente', [], 'caixa');
    const approverMember = await val<string>(
      service,
      'select id from public.memberships where tenant_id = $1 and user_id = $2',
      [tenant, approver],
    );
    await q(as(owner), `select public.member_grant($1, $2, 'caixa.sangria', 'direct', null, false, null)`, [
      tenant,
      approverMember,
    ]);
    const req = await val<string>(
      as(operador),
      `select public.approval_request_create($1, 'caixa.sangria', 'cash.sangria', 'Sangria', 80000, $2, 'depósito')`,
      [tenant, JSON.stringify({ amount_cents: 80000, reason: 'depósito' })],
    );
    await q(as(approver), 'select public.approval_decide($1, $2, true, null)', [tenant, req]);
    const grant = await val<string>(
      service,
      `select id from public.member_permissions where membership_id = $1 and permission_code = 'caixa.sangria' and revoked_at is null`,
      [approverMember],
    );
    await q(as(owner), 'select public.member_revoke($1, $2)', [tenant, grant]);
    expect(await errorCode(() => q(as(operador), 'select public.approval_execute($1, $2)', [tenant, req]))).toBe(
      'APPROVER_REVOKED',
    );
  });

  it('fechamento de caixa confere valores e exige justificativa em divergência', async () => {
    const session = await val<string>(
      service,
      `select id from public.cash_sessions where tenant_id = $1 and operator_id = $2 and status = 'open'`,
      [tenant, operador],
    );
    const expected = await val<{ methods: { method_id: string; expected_cents: number; kind: string }[] }>(
      as(operador),
      'select public.cash_session_expected($1, $2)',
      [tenant, session],
    );
    const counted: Record<string, number> = {};
    for (const m of expected.methods) counted[m.method_id] = m.expected_cents;
    const cashMethod = expected.methods.find((m) => m.kind === 'dinheiro')!;
    const wrong = { ...counted, [cashMethod.method_id]: cashMethod.expected_cents - 500 };
    expect(
      await errorCode(() =>
        q(as(operador), 'select public.cash_session_close($1, $2, $3, null)', [tenant, session, JSON.stringify(wrong)]),
      ),
    ).toBe('DIVERGENCE_NOTE_REQUIRED');
    const closed = await val<{ status: string; divergence_cents: number }>(
      as(operador),
      'select public.cash_session_close($1, $2, $3, $4)',
      [tenant, session, JSON.stringify(wrong), 'Faltou troco'],
    );
    expect(closed.status).toBe('closed');
    expect(closed.divergence_cents).toBe(-500);
    // Comandas abertas não impediram o fechamento
    expect(await val<number>(service, `select count(*)::int from public.tabs where tenant_id = $1 and status = 'open'`, [tenant])).toBeGreaterThan(0);
  });

  it('indisponibilidade na cozinha volta para o atendimento resolver', async () => {
    const tab = await val<Tab>(as(garcom), 'select public.tab_open($1, null, $2, null, $3)', [tenant, 'Indisp', key()]);
    const created = await val<{ order: { id: string } }>(as(garcom), 'select public.order_create($1, $2, $3, null, $4)', [
      tenant,
      tab.id,
      JSON.stringify([
        { product_id: s.pizza, quantity: 1 },
        { product_id: s.soda, quantity: 1 },
      ]),
      key(),
    ]);
    const item = await val<string>(service, 'select id from public.order_items where order_id = $1 and product_id = $2', [
      created.order.id,
      s.soda,
    ]);
    await q(as(cozinheiro), `select public.kitchen_advance($1, $2, 'preparing')`, [tenant, created.order.id]);
    await q(as(cozinheiro), `select public.kitchen_item_unavailable($1, $2, 'acabou')`, [tenant, item]);
    expect(await errorCode(() => q(as(cozinheiro), `select public.kitchen_advance($1, $2, 'ready')`, [tenant, created.order.id]))).toBe(
      'ORDER_HAS_ISSUE',
    );
    const total = await val<number>(service, 'select total_cents::int from public.tabs where id = $1', [tab.id]);
    expect(total).toBe(4990);
    await q(as(garcom), 'select public.order_resolve_issue($1, $2)', [tenant, created.order.id]);
    await q(as(cozinheiro), `select public.kitchen_advance($1, $2, 'ready')`, [tenant, created.order.id]);
    // Produto indisponível não pode ser pedido novamente até ser liberado
    expect(
      await errorCode(() =>
        q(as(garcom), 'select public.order_create($1, $2, $3, null, $4)', [
          tenant,
          tab.id,
          JSON.stringify([{ product_id: s.soda, quantity: 1 }]),
          key(),
        ]),
      ),
    ).toBe('PRODUCT_UNAVAILABLE');
    await q(as(cozinheiro), 'select public.product_set_available($1, $2, true)', [tenant, s.soda]);
  });

  it('transferência de mesa exige destino livre e aprovação para garçom', async () => {
    const t3 = await val<string>(as(owner), `select public.table_save($1, null, '03', null, 2::smallint, true, 3)`, [tenant]);
    const t4 = await val<string>(as(owner), `select public.table_save($1, null, '04', null, 2::smallint, true, 4)`, [tenant]);
    const tab = await val<Tab>(as(garcom), 'select public.tab_open($1, $2, null, 2::smallint, $3)', [tenant, t3, key()]);
    await val<Tab>(as(garcom), 'select public.tab_open($1, $2, null, 2::smallint, $3)', [tenant, t4, key()]);
    expect(await errorCode(() => q(as(garcom), 'select public.tab_transfer($1, $2, $3)', [tenant, tab.id, t4]))).toBe(
      'APPROVAL_REQUIRED',
    );
    expect(await errorCode(() => q(as(owner), 'select public.tab_transfer($1, $2, $3)', [tenant, tab.id, t4]))).toBe(
      'TABLE_OCCUPIED',
    );
    const t5 = await val<string>(as(owner), `select public.table_save($1, null, '05', null, 2::smallint, true, 5)`, [tenant]);
    const moved = await val<Tab>(as(owner), 'select public.tab_transfer($1, $2, $3)', [tenant, tab.id, t5]);
    expect(moved.table_id).toBe(t5);
  });

  it('estorno reabre a comanda com saldo', async () => {
    await q(as(owner), 'select public.cash_session_open($1, 0, $2)', [tenant, key()]);
    const tab = await val<Tab>(as(garcom), 'select public.tab_open($1, null, $2, null, $3)', [tenant, 'Estorno', key()]);
    const o = await val<{ order: { id: string } }>(as(garcom), 'select public.order_create($1, $2, $3, null, $4)', [
      tenant,
      tab.id,
      JSON.stringify([{ product_id: s.soda, quantity: 1 }]),
      key(),
    ]);
    await q(as(cozinheiro), `select public.kitchen_advance($1, $2, 'preparing')`, [tenant, o.order.id]);
    await q(as(cozinheiro), `select public.kitchen_advance($1, $2, 'ready')`, [tenant, o.order.id]);
    await q(as(garcom), 'select public.order_deliver($1, $2)', [tenant, o.order.id]);
    const paid = await val<{ payment: { id: string }; tab: Tab }>(
      as(owner),
      `select public.payment_register($1, $2, $3, 700, null, null, 'caixa', $4)`,
      [tenant, tab.id, s.pix, key()],
    );
    expect(paid.tab.status).toBe('closed');
    const refunded = await val<Tab>(as(owner), `select public.payment_refund($1, $2, 'cobrado em duplicidade')`, [
      tenant,
      paid.payment.id,
    ]);
    expect(refunded.status).toBe('open');
    expect(refunded.balance_cents).toBe(700);
  });
});

describe('cardápio local por QR Code', () => {
  let owner: string;
  let tenant: string;
  let garcom: string;
  let s: Awaited<ReturnType<typeof seedOperation>>;

  beforeAll(async () => {
    owner = await createUser('Titular QR');
    tenant = (await createTenant(owner)).tenantId;
    s = await seedOperation(tenant, owner);
    garcom = await addMember(tenant, owner, 'Garçom QR', ['Atendente'], 'atendimento');
  });

  it('modo somente garçom bloqueia pedido do cliente', async () => {
    const menu = await val<{ state: string; mode: string; table: { label: string } }>(
      anon,
      'select public.public_table_menu($1, null)',
      [s.qr],
    );
    expect(menu.state).toBe('ok');
    expect(menu.table.label).toBe('01');
    expect(menu.mode).toBe('garcom');
    expect(
      await errorCode(() =>
        q(anon, 'select public.public_table_order($1, $2, $3, null, $4)', [
          s.qr,
          key('guest'),
          JSON.stringify([{ product_id: s.pizza, quantity: 1 }]),
          key(),
        ]),
      ),
    ).toBe('ORDERING_DISABLED');
  });

  it('cliente pede pela mesa, atendente confirma e cada cliente vê só os próprios pedidos', async () => {
    await q(as(owner), `select public.tenant_update_settings($1, '{"local_order_mode":"ambos","local_order_confirmation":"atendente"}')`, [
      tenant,
    ]);
    const guestA = key('guestA');
    const guestB = key('guestB');
    const placed = await val<{ status: string; order_number: number }>(
      anon,
      'select public.public_table_order($1, $2, $3, null, $4)',
      [s.qr, guestA, JSON.stringify([{ product_id: s.pizza, quantity: 1 }]), key()],
    );
    expect(placed.status).toBe('pending_confirmation');
    await q(anon, 'select public.public_table_order($1, $2, $3, null, $4)', [
      s.qr,
      guestB,
      JSON.stringify([{ product_id: s.soda, quantity: 1 }]),
      key(),
    ]);
    const viewA = await val<{ my_orders: { items: { name: string }[] }[] }>(anon, 'select public.public_table_menu($1, $2)', [
      s.qr,
      guestA,
    ]);
    expect(viewA.my_orders).toHaveLength(1);
    expect(viewA.my_orders[0]!.items[0]!.name).toBe('Margherita');
    const viewNobody = await val<{ my_orders: unknown[] }>(anon, 'select public.public_table_menu($1, $2)', [s.qr, key('x')]);
    expect(viewNobody.my_orders).toHaveLength(0);

    // Pedido pendente não entra na conta até ser confirmado
    const tabId = await val<string>(service, `select id from public.tabs where table_id = $1 and status = 'open'`, [s.table1]);
    expect(await val<number>(service, 'select total_cents::int from public.tabs where id = $1', [tabId])).toBe(0);
    const pending = await q<{ id: string }>(service, `select id from public.orders where tab_id = $1 and status = 'pending_confirmation'`, [
      tabId,
    ]);
    for (const o of pending) await q(as(garcom), 'select public.order_review_customer($1, $2, true, null)', [tenant, o.id]);
    expect(await val<number>(service, 'select total_cents::int from public.tabs where id = $1', [tabId])).toBe(5690);

    // Pedir a conta
    await q(anon, 'select public.public_table_request_bill($1, $2)', [s.qr, guestA]);
    expect(await val(service, 'select bill_requested_by from public.tabs where id = $1', [tabId])).toBe('cliente');
  });

  it('novo QR Code invalida o link antigo', async () => {
    const newToken = await val<string>(as(owner), 'select public.table_rotate_qr($1, $2)', [tenant, s.table1]);
    expect(newToken).not.toBe(s.qr);
    expect((await val<{ state: string }>(anon, 'select public.public_table_menu($1, null)', [s.qr])).state).toBe('invalid_qr');
  });
});

describe('modelos públicos e configurações por área', () => {
  it('o restaurante escolhe os modelos do Cardápio e do Delivery; áreas não se misturam', async () => {
    const owner = await createUser('Titular Modelos');
    const { tenantId: tenant, slug } = await createTenant(owner);
    expect(await val(anon, 'select public.public_templates($1)', [slug])).toEqual({ cardapio: 'm1', delivery: 'm1' });
    await q(as(owner), `select public.tenant_update_settings($1, '{"cardapio_template":"m3"}')`, [tenant]);
    await q(as(owner), `select public.tenant_update_settings($1, '{"delivery_template":"m2"}')`, [tenant]);
    expect(await val(anon, 'select public.public_templates($1)', [slug])).toEqual({ cardapio: 'm3', delivery: 'm2' });
    expect(await errorCode(() => q(as(owner), `select public.tenant_update_settings($1, '{"cardapio_template":"m9"}')`, [tenant]))).toBe('INVALID');
    expect(
      await errorCode(() => q(as(owner), `select public.tenant_update_settings($1, '{"cardapio_template":"m2","delivery_enabled":true}')`, [tenant])),
    ).toBe('INVALID');
    expect(await errorCode(() => q(as(owner), `select public.tenant_update_settings($1, '{"service_fee_percent":10,"local_order_mode":"ambos"}')`, [tenant]))).toBe(
      'INVALID',
    );
  });
});

describe('delivery', () => {
  it('pedido público → aceitação → produção → entrega → pagamento → encerramento', async () => {
    const owner = await createUser('Titular Delivery');
    const { tenantId: tenant, slug } = await createTenant(owner);
    const s = await seedOperation(tenant, owner);
    const zone = await val<string>(as(owner), `select public.delivery_zone_save($1, null, 'Centro', '{Centro}', 800, 3000, 40, true)`, [
      tenant,
    ]);
    // Delivery desligado
    expect((await val<{ state: string }>(anon, 'select public.public_delivery_menu($1)', [slug])).state).toBe('unavailable');
    await q(as(owner), `select public.tenant_update_settings($1, '{"delivery_enabled":true}')`, [tenant]);
    const menu = await val<{ state: string; zones: unknown[] }>(anon, 'select public.public_delivery_menu($1)', [slug]);
    expect(menu.state).toBe('ok');
    expect(menu.zones).toHaveLength(1);

    const address = JSON.stringify({ street: 'Rua A', number: '10', neighborhood: 'Centro' });
    const customer = JSON.stringify({ name: 'Cliente', whatsapp: '(11) 98888-7777' });
    expect(
      await errorCode(() =>
        q(anon, 'select public.public_delivery_order($1, $2, $3, $4, $5, null, null, null, $6)', [
          slug,
          customer,
          address,
          zone,
          JSON.stringify([{ product_id: s.soda, quantity: 1 }]),
          key(),
        ]),
      ),
    ).toBe('MIN_ORDER');
    const placed = await val<{ tracking_token: string }>(
      anon,
      'select public.public_delivery_order($1, $2, $3, $4, $5, $6, $7, null, $8)',
      [slug, customer, address, zone, JSON.stringify([{ product_id: s.pizza, quantity: 1 }]), 'sem orégano', s.pix, key()],
    );
    const track = await val<{ status: string; items_cents: number }>(anon, 'select public.public_delivery_tracking($1)', [
      placed.tracking_token,
    ]);
    expect(track.status).toBe('awaiting_acceptance');

    const tabId = await val<string>(service, 'select tab_id from public.delivery_orders where tracking_token = $1', [
      placed.tracking_token,
    ]);
    await q(as(owner), 'select public.delivery_review($1, $2, true, null)', [tenant, tabId]);
    const order = await val<string>(service, 'select id from public.orders where tab_id = $1', [tabId]);
    expect(await errorCode(() => q(as(owner), 'select public.delivery_dispatch($1, $2)', [tenant, tabId]))).toBe('NOT_READY');
    await q(as(owner), `select public.kitchen_advance($1, $2, 'preparing')`, [tenant, order]);
    await q(as(owner), `select public.kitchen_advance($1, $2, 'ready')`, [tenant, order]);
    await q(as(owner), 'select public.delivery_dispatch($1, $2)', [tenant, tabId]);
    const done = await val<Tab>(as(owner), 'select public.delivery_complete($1, $2)', [tenant, tabId]);
    expect(done.total_cents).toBe(4990 + 800);
    expect(done.status).toBe('open');
    const paid = await val<{ closed: boolean }>(
      as(owner),
      `select public.payment_register($1, $2, $3, 5790, null, null, 'delivery', $4)`,
      [tenant, tabId, s.pix, key()],
    );
    expect(paid.closed).toBe(true);
    expect((await val<{ status: string }>(anon, 'select public.public_delivery_tracking($1)', [placed.tracking_token])).status).toBe(
      'delivered',
    );
  });
});
