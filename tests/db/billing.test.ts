import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

// Projeto comercial (assinaturas): ciclo de vida da assinatura e isolamento.
const pool = new pg.Pool({
  connectionString: process.env.PDP_TEST_BILLING_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres',
  max: 4,
});
afterAll(() => pool.end());

async function q<T = Record<string, unknown>>(
  role: 'service_role' | 'anon' | 'authenticated',
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('role', $1, true)`, [role]);
    const r = await c.query(sql, params);
    await c.query('commit');
    return r.rows as T[];
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}
const val = async <T>(sql: string, params: unknown[] = []) =>
  Object.values((await q('service_role', sql, params))[0] ?? {})[0] as T;
async function code(fn: () => Promise<unknown>) {
  try {
    await fn();
    return 'NO_ERROR';
  } catch (e) {
    return (e as { detail?: string }).detail ?? 'UNKNOWN';
  }
}
const slug = () => `b${randomUUID().replace(/-/g, '').slice(0, 10)}`;

async function subscribe(identity: string, plan = 'start', s = slug(), key = randomUUID()) {
  const r = await val<{ subscription_id: string; status: string }>(
    `select public.billing_subscribe($1, 'dono@teste.local', 'Dono', $2, 'Restaurante', $3, 'vitest', $4)`,
    [identity, plan, s, key],
  );
  return { ...r, slug: s, key };
}

describe('assinaturas', () => {
  it('contratação é idempotente e o endereço é único', async () => {
    const id = randomUUID();
    const a = await subscribe(id);
    expect(a.status).toBe('pending_payment');
    const again = await val<{ subscription_id: string }>(
      `select public.billing_subscribe($1, 'dono@teste.local', 'Dono', 'start', 'Restaurante', $2, 'vitest', $3)`,
      [id, a.slug, a.key],
    );
    expect(again.subscription_id).toBe(a.subscription_id);
    expect(await val<number>('select count(*)::int from public.invoices where subscription_id = $1', [a.subscription_id])).toBe(
      1,
    );
    expect(await val<number>('select count(*)::int from public.contracts where subscription_id = $1', [a.subscription_id])).toBe(
      1,
    );
    expect(await code(() => subscribe(randomUUID(), 'start', a.slug))).toBe('SLUG_TAKEN');
    expect(await code(() => subscribe(id, 'inexistente'))).toBe('INVALID_PLAN');
  });

  it('renovação e troca exigem pagamento; cancelamento respeita o período', async () => {
    const id = randomUUID();
    const { subscription_id: sub } = await subscribe(id);
    expect(await code(() => q('service_role', 'select public.billing_renew($1, $2)', [id, sub]))).toBe('PAYMENT_REQUIRED');
    expect(await code(() => q('service_role', `select public.billing_change_plan($1, $2, 'diamond')`, [id, sub]))).toBe(
      'PAYMENT_REQUIRED',
    );
    expect(await val<number>('select count(*)::int from public.invoices where subscription_id = $1', [sub])).toBe(1);
    // Fixture LOCAL para testar o ciclo de cancelamento sem simular pagamento remoto.
    await q(
      'service_role',
      `update public.subscriptions set status = 'active', current_period_start = now(),
      current_period_end = now() + interval '30 days' where id = $1`,
      [sub],
    );
    await q('service_role', 'select public.billing_cancel($1, $2, false)', [id, sub]);
    expect(await val<boolean>('select cancel_at_period_end from public.subscriptions where id = $1', [sub])).toBe(true);
    await q('service_role', 'select public.billing_cancel($1, $2, true)', [id, sub]);
    expect(await val<boolean>('select cancel_at_period_end from public.subscriptions where id = $1', [sub])).toBe(false);
    // Vence o período com cancelamento agendado → encerra
    await q('service_role', 'select public.billing_cancel($1, $2, false)', [id, sub]);
    await q('service_role', `update public.subscriptions set current_period_end = now() - interval '1 minute' where id = $1`, [
      sub,
    ]);
    await q('service_role', 'select public.billing_settle_expired()');
    expect(await val<string>('select status::text from public.subscriptions where id = $1', [sub])).toBe('cancelled');
  });

  it('um titular não opera nem enxerga a assinatura de outro', async () => {
    const owner = randomUUID();
    const intruder = randomUUID();
    const { subscription_id: sub } = await subscribe(owner);
    expect(await code(() => q('service_role', 'select public.billing_cancel($1, $2, false)', [intruder, sub]))).toBe('NOT_FOUND');
    const overview = await val<{ subscriptions: unknown[] }>('select public.billing_overview($1)', [intruder]);
    expect(overview.subscriptions).toEqual([]);
  });

  it('requisições concorrentes da mesma contratação geram uma assinatura e uma fatura', async () => {
    const id = randomUUID(),
      address = slug(),
      key = randomUUID();
    const results = await Promise.all([subscribe(id, 'start', address, key), subscribe(id, 'start', address, key)]);
    expect(results[0]!.subscription_id).toBe(results[1]!.subscription_id);
    expect(
      await val<number>('select count(*)::int from public.invoices where subscription_id = $1', [results[0]!.subscription_id]),
    ).toBe(1);
    expect(results.every((r) => r.status === 'pending_payment')).toBe(true);
  });

  it('navegador só lê o catálogo de planos, sem preços inventados', async () => {
    const plans = await q<{ code: string; price_cents: number | null }>(
      'anon',
      'select code, price_cents from public.plans order by position',
    );
    expect(plans.map((p) => p.code)).toEqual(['start', 'plus', 'diamond']);
    expect(plans.map((p) => Number(p.price_cents))).toEqual([4999, 8000, 15000]);
    expect(await code(() => q('anon', 'select * from public.subscriptions'))).not.toBe('NO_ERROR');
    expect(await code(() => q('authenticated', `select public.billing_overview(gen_random_uuid())`))).not.toBe('NO_ERROR');
  });
});
