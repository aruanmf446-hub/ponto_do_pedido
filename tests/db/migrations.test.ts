import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import pg from 'pg';
import { expect, it } from 'vitest';

it('migra dados legados sem alterar valores, estados ou permissões de outras funções', async () => {
  const raw = process.env.PDP_TEST_BILLING_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';
  const url = new URL(raw);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw Error('Teste de migração permitido somente no PostgreSQL local.');
  const db = `migration_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: raw });
  await admin.connect();
  let c: pg.Client | undefined;
  try {
    await admin.query(`create database "${db}"`);
    url.pathname = `/${db}`;
    c = new pg.Client({ connectionString: url.toString() });
    await c.connect();
    await c.query(`create schema extensions; grant usage on schema public,extensions to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to service_role;
      alter default privileges in schema public grant all on sequences to service_role;`);
    const dir = 'backend/billing/supabase/migrations';
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files.slice(0, 4)) await c.query(readFileSync(`${dir}/${file}`, 'utf8'));
    await c.query(`update public.platform_settings set value='"termos-legados"' where key='terms_version'`);
    await c.query(
      `select public.billing_subscribe($1,'fixture@local.invalid','Local','start','Fixture local','migration-fixture','vitest','migration-key')`,
      [randomUUID()],
    );
    await c.query(
      `create function public.unrelated_product_probe() returns boolean language sql as 'select true'; grant execute on function public.unrelated_product_probe() to anon;`,
    );
    const snapshot = async () => {
      const result: Record<string, unknown> = {};
      for (const table of ['plans', 'accounts', 'subscriptions', 'contracts', 'invoices', 'platform_settings']) {
        result[table] = (
          await c!.query(
            `select jsonb_agg(to_jsonb(t)-'product_id'-'trial_started_at'-'trial_ends_at' order by (to_jsonb(t)-'product_id'-'trial_started_at'-'trial_ends_at')::text) as r from public.${table} t`,
          )
        ).rows[0].r;
      }
      return result;
    };
    const before = await snapshot();
    for (const file of files.slice(4)) await c.query(readFileSync(`${dir}/${file}`, 'utf8'));
    expect(await snapshot()).toEqual(before);
    // Os novos campos são opcionais e não modificam a assinatura legada.
    expect((await c.query(`select trial_started_at, trial_ends_at from public.subscriptions
      where restaurant_slug='migration-fixture'`)).rows).toEqual([
      { trial_started_at: null, trial_ends_at: null },
    ]);
    expect((await c.query(`select distinct product_id from public.subscriptions`)).rows).toEqual([
      { product_id: 'ponto_do_pedido' },
    ]);
    expect((await c.query(`select terms_version from public.products where id='ponto_do_pedido'`)).rows[0].terms_version).toBe(
      'termos-legados',
    );
    for (const role of ['anon', 'authenticated']) {
      const perms = (
        await c.query(
          `select has_function_privilege($1,'public.billing_product_call(text,text,jsonb)','execute') gateway,
        has_function_privilege($1,'public.billing_product_config(text)','execute') config,
        has_function_privilege($1,'public.billing_checkout_policy()','execute') policy,
        has_function_privilege($1,'public.billing_subscribe(uuid,text,text,text,text,text,text,text)','execute') subscribe`,
          [role],
        )
      ).rows[0];
      expect(perms).toEqual({ gateway: false, config: false, policy: false, subscribe: false });
    }
    expect(
      (await c.query(`select has_function_privilege('anon','public.unrelated_product_probe()','execute') as allowed`)).rows[0]
        .allowed,
    ).toBe(true);
    const next = (
      await c.query(
        `select public.billing_subscribe($1,'fixture@local.invalid','Local','start','Novo local','migration-new','vitest','new-key') as r`,
        [randomUUID()],
      )
    ).rows[0].r;
    expect(next.status).toBe('pending_payment');
  } finally {
    await c?.end();
    // Remove apenas o banco aleatório criado por este teste, nunca o banco fornecido.
    await admin.query(`drop database if exists "${db}"`);
    await admin.end();
  }
});
