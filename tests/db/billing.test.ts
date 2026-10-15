import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

// Projeto comercial (assinaturas): ciclo de vida da assinatura e isolamento.
const pool = new pg.Pool({ connectionString: process.env.PDP_TEST_BILLING_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres', max: 4 });
afterAll(() => pool.end());

async function q<T = Record<string, unknown>>(role: 'service_role' | 'anon' | 'authenticated', sql: string, params: unknown[] = []): Promise<T[]> {
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
const val = async <T,>(sql: string, params: unknown[] = []) => Object.values((await q('service_role', sql, params))[0] ?? {})[0] as T;
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
    expect(a.status).toBe('active');
    const again = await val<{ subscription_id: string }>(
      `select public.billing_subscribe($1, 'dono@teste.local', 'Dono', 'start', 'Restaurante', $2, 'vitest', $3)`,
      [id, a.slug, a.key],
    );
    expect(again.subscription_id).toBe(a.subscription_id);
    expect(await code(() => subscribe(randomUUID(), 'start', a.slug))).toBe('SLUG_TAKEN');
    expect(await code(() => subscribe(id, 'inexistente'))).toBe('INVALID_PLAN');
  });

  it('renovação, troca de plano e cancelamento ao fim do período', async () => {
    const id = randomUUID();
    const { subscription_id: sub } = await subscribe(id);
    await q('service_role', 'select public.billing_renew($1, $2)', [id, sub]);
    expect(await val<number>('select count(*)::int from public.invoices where subscription_id = $1', [sub])).toBe(2);
    await q('service_role', `select public.billing_change_plan($1, $2, 'diamond')`, [id, sub]);
    expect(await val<string>('select plan_code from public.subscriptions where id = $1', [sub])).toBe('diamond');
    await q('service_role', 'select public.billing_cancel($1, $2, false)', [id, sub]);
    expect(await val<boolean>('select cancel_at_period_end from public.subscriptions where id = $1', [sub])).toBe(true);
    await q('service_role', 'select public.billing_cancel($1, $2, true)', [id, sub]);
    expect(await val<boolean>('select cancel_at_period_end from public.subscriptions where id = $1', [sub])).toBe(false);
    // Vence o período com cancelamento agendado → encerra
    await q('service_role', 'select public.billing_cancel($1, $2, false)', [id, sub]);
    await q('service_role', `update public.subscriptions set current_period_end = now() - interval '1 minute' where id = $1`, [sub]);
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

  it('navegador só lê o catálogo de planos, sem preços inventados', async () => {
    const plans = await q<{ code: string; price_cents: number | null }>('anon', 'select code, price_cents from public.plans order by position');
    expect(plans.map((p) => p.code)).toEqual(['start', 'plus', 'diamond']);
    expect(plans.every((p) => p.price_cents === null)).toBe(true);
    expect(await code(() => q('anon', 'select * from public.subscriptions'))).not.toBe('NO_ERROR');
    expect(await code(() => q('authenticated', `select public.billing_overview(gen_random_uuid())`))).not.toBe('NO_ERROR');
  });
});
