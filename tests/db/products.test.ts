import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

// Fixtures somente no banco LOCAL/CI, revertidas ao terminar cada teste.
const pool = new pg.Pool({
  connectionString: process.env.PDP_TEST_BILLING_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres',
});
let c: pg.PoolClient;
const product = 'oficina_unit';
const owner = randomUUID();
const key = randomUUID();
const slug = `unit-${randomUUID().slice(0, 8)}`;
const call = async (p: string, action: string, args: Record<string, unknown>) =>
  (await c.query('select public.billing_product_call($1,$2,$3) as r', [p, action, args])).rows[0].r;
const subscribe = (p: string) =>
  call(p, 'subscribe', {
    p_identity: owner,
    p_email: 'unit@local.invalid',
    p_name: 'Teste',
    p_plan: 'start',
    p_restaurant_name: 'Empresa',
    p_slug: slug,
    p_user_agent: 'vitest',
    p_idempotency_key: key,
  });
async function fails(sql: string, params: unknown[]) {
  await c.query('savepoint negative');
  try {
    await c.query(sql, params);
    return 'NO_ERROR';
  } catch (e) {
    const error = e as { detail?: string; code?: string };
    return error.code === 'P0001' ? error.detail : error.code;
  } finally {
    await c.query('rollback to savepoint negative');
  }
}
beforeEach(async () => {
  c = await pool.connect();
  await c.query('begin');
  await c.query(
    `insert into public.products(id,name,auth_url,auth_publishable_key,allowed_return_urls,payment_return_url)
    values ($1,'Oficina unitária','https://abcdefghijklmnopqrst.supabase.co','sb_publishable_unit_only_key',array['https://oficina.unit/portal'],'https://oficina.unit/portal')`,
    [product],
  );
  await c.query(
    `insert into public.plans(product_id,code,name,modules,price_cents,billing_period) values ($1,'start','Plano oficina',array['ordens_servico'],12345,'yearly')`,
    [product],
  );
});
afterEach(async () => {
  await c.query('rollback');
  c.release();
});
afterAll(() => pool.end());

describe('isolamento comercial por produto', () => {
  it('mesmo UUID, código, slug e chave idempotente ficam separados por produto', async () => {
    const a = await subscribe('ponto_do_pedido');
    const b = await subscribe(product);
    expect(a.status).toBe('pending_payment');
    expect(b.status).toBe('pending_payment');
    expect(a.subscription_id).not.toBe(b.subscription_id);
    expect((await subscribe(product)).subscription_id).toBe(b.subscription_id);
    for (const [p, id, price, module] of [
      ['ponto_do_pedido', a.subscription_id, 4999, 'gestao'],
      [product, b.subscription_id, 12345, 'ordens_servico'],
    ] as const) {
      const overview = await call(p, 'overview', { p_identity: owner });
      expect(overview.product_id).toBe(p);
      expect(overview.subscriptions).toHaveLength(1);
      expect(overview.subscriptions[0]).toMatchObject({ id, product_id: p, price_cents: price });
      expect(overview.subscriptions[0].modules).toContain(module);
      expect(overview.subscriptions[0].invoices).toHaveLength(1);
      expect(overview.subscriptions[0].invoices[0].product_id).toBe(p);
      const contracts = await c.query('select product_id from public.contracts where subscription_id=$1', [id]);
      expect(contracts.rows).toEqual([{ product_id: p }]);
    }
  });
  it('mesmo titular não cancela nem inicia pagamento da assinatura de outro produto', async () => {
    const a = await subscribe('ponto_do_pedido');
    await c.query(`update public.platform_settings set value='"mercadopago"' where key='payment_provider'`);
    for (const action of ['cancel', 'payment_context']) {
      expect(
        await fails('select public.billing_product_call($1,$2,$3)', [
          product,
          action,
          { p_identity: owner, p_subscription: a.subscription_id, p_undo: false },
        ]),
      ).toBe('NOT_FOUND');
    }
    const overview = await call(product, 'overview', { p_identity: owner });
    expect(overview.subscriptions).toEqual([]);
    expect(await call(product, 'subscription_result', { p_identity: owner, p_idempotency_key: key })).toBeNull();
  });
  it('chaves estrangeiras impedem fatura ou conta cruzada entre produtos', async () => {
    const a = await subscribe('ponto_do_pedido');
    await subscribe(product);
    expect(await fails('update public.invoices set product_id=$1 where subscription_id=$2', [product, a.subscription_id])).toBe(
      '23503',
    );
    expect(
      await fails(`update public.subscriptions set product_id=$1, restaurant_slug='different-unit-slug' where id=$2`, [
        product,
        a.subscription_id,
      ]),
    ).toBe('23503');
  });
  it('webhook central resolve produto, valor e período pela assinatura sem afetar o outro produto', async () => {
    const a = await subscribe('ponto_do_pedido');
    const b = await subscribe(product);
    await c.query(`update public.platform_settings set value='"mercadopago"' where key='payment_provider'`);
    await call(product, 'payment_started', {
      p_subscription: b.subscription_id,
      p_provider_subscription_id: 'unit-provider',
      p_checkout_url: 'https://payment.unit/checkout',
    });
    const event = {
      id: 'unit-resource',
      preapproval_id: 'unit-provider',
      currency_id: 'BRL',
      transaction_amount: 123.45,
      payment: { id: 'unit-payment', status: 'approved' },
    };
    const wrongAmount = (
      await c.query(`select public.billing_apply_mercadopago('unit-wrong-amount','authorized_payment',$1) as r`, [
        { ...event, transaction_amount: 49.99 },
      ])
    ).rows[0].r;
    expect(wrongAmount).toMatchObject({ ignored: true, reason: 'PAYMENT_AMOUNT_MISMATCH' });
    const apply = async () =>
      (await c.query(`select public.billing_apply_mercadopago('unit-product-event','authorized_payment',$1) as r`, [event]))
        .rows[0].r;
    expect(await apply()).toMatchObject({ subscription_id: b.subscription_id, status: 'active' });
    expect(await apply()).toEqual({ duplicate: true });
    expect(
      (await c.query('select product_id from public.payment_events where event_key=$1', ['unit-product-event'])).rows,
    ).toEqual([{ product_id: product }]);
    const period = (
      await c.query("select current_period_end > now() + interval '360 days' as yearly from public.subscriptions where id=$1", [
        b.subscription_id,
      ])
    ).rows[0];
    expect(period.yearly).toBe(true);
    const overview = await call('ponto_do_pedido', 'overview', { p_identity: owner });
    expect(overview.subscriptions[0]).toMatchObject({ id: a.subscription_id, status: 'pending_payment' });
  });
  it('produto desativado não atende gateway nem catálogo', async () => {
    await c.query('update public.products set active=false where id=$1', [product]);
    expect(await fails('select public.billing_product_call($1,$2,$3)', [product, 'overview', { p_identity: owner }])).toBe(
      'INVALID_PRODUCT',
    );
    expect((await c.query('select * from public.billing_public_plans($1)', [product])).rows).toEqual([]);
  });
  it('catálogo público filtra produto e cadastro Auth não fica público', async () => {
    await c.query('set local role anon');
    const plans = (await c.query('select * from public.billing_public_plans($1)', [product])).rows;
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ product_id: product, price_cents: '12345' });
    expect(await fails('select * from public.products', [])).toBe('42501');
    expect(await fails('select public.billing_product_call($1, $2, $3)', [product, 'overview', { p_identity: owner }])).toBe(
      '42501',
    );
  });
});
