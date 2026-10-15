import { randomUUID } from 'node:crypto';
import pg from 'pg';

export const DB_URL = process.env.PDP_TEST_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export const pool = new pg.Pool({ connectionString: DB_URL, max: 8 });

export type Actor = { kind: 'user'; id: string } | { kind: 'anon' } | { kind: 'service' };

export const anon: Actor = { kind: 'anon' };
export const service: Actor = { kind: 'service' };
export const as = (id: string): Actor => ({ kind: 'user', id });

/** Executa uma consulta como o papel indicado, numa transação própria (como o PostgREST). */
export async function q<T = Record<string, unknown>>(actor: Actor, sql: string, params: unknown[] = []): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    if (actor.kind === 'user') {
      await client.query("select set_config('role', 'authenticated', true)");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: actor.id, role: 'authenticated' }),
      ]);
    } else if (actor.kind === 'anon') {
      await client.query("select set_config('role', 'anon', true)");
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: 'anon' })]);
    } else {
      await client.query("select set_config('role', 'service_role', true)");
    }
    const res = await client.query(sql, params);
    await client.query('commit');
    return res.rows as T[];
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function one<T = Record<string, unknown>>(actor: Actor, sql: string, params: unknown[] = []): Promise<T> {
  const rows = await q<T>(actor, sql, params);
  if (!rows[0]) throw new Error('Nenhuma linha retornada');
  return rows[0];
}

/** Valor da primeira coluna da primeira linha. */
export async function val<T = unknown>(actor: Actor, sql: string, params: unknown[] = []): Promise<T> {
  const row = await one<Record<string, T>>(actor, sql, params);
  return Object.values(row)[0] as T;
}

/** Código de erro de negócio (DETAIL) lançado por uma chamada. */
export async function errorCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    const e = error as { detail?: string; message?: string };
    return e.detail ?? e.message ?? 'UNKNOWN';
  }
  return 'NO_ERROR';
}

export async function createUser(name = 'Usuário'): Promise<string> {
  const id = randomUUID();
  const email = `${id.slice(0, 8)}@teste.pontodopedido.local`;
  const client = await pool.connect();
  try {
    await client.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now(),
        '{"provider":"email","providers":["email"]}', $3, now(), now())`,
      [id, email, JSON.stringify({ full_name: name })],
    );
  } finally {
    client.release();
  }
  return id;
}

export const ALL_MODULES = ['gestao', 'caixa', 'atendimento', 'cozinha', 'cardapio', 'delivery', 'financeiro', 'estoque'];

export async function createTenant(owner: string, modules = ALL_MODULES, status = 'active') {
  const slug = `t${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const subscription = randomUUID();
  const tenantId = await val<string>(
    service,
    `select public.admin_sync_license($1, $2, $3, $4, $5::public.tenant_status, 'diamond', now() + interval '30 days', $6::public.app_module[])`,
    [owner, subscription, slug, 'Restaurante ' + slug, status, modules],
  );
  return { tenantId, slug, subscription };
}

export async function roleId(tenantId: string, name: string): Promise<string> {
  return val<string>(service, 'select id from public.roles where tenant_id = $1 and name = $2', [tenantId, name]);
}

/** Cria colaborador vinculado com as funções indicadas (via função de equipe). */
export async function addMember(tenantId: string, owner: string, name: string, roles: string[], primaryApp = 'atendimento') {
  const user = await createUser(name);
  const roleIds = await Promise.all(roles.map((r) => roleId(tenantId, r)));
  await val(service, `select public.admin_attach_member($1, $2, $3, $4, $5, $6::public.app_module, $7::uuid[], false)`, [
    owner,
    tenantId,
    user,
    name,
    roles.join(', '),
    primaryApp,
    roleIds,
  ]);
  return user;
}

export function key(prefix = 'k'): string {
  return `${prefix}${randomUUID().replace(/-/g, '')}`;
}

/** Cenário mínimo de operação: setor, mesa, categoria, 2 produtos, métodos. */
export async function seedOperation(tenantId: string, owner: string) {
  const u = as(owner);
  const sector = await val<string>(u, `select public.sector_save($1, null, 'Salão', 'salao', true, 0)`, [tenantId]);
  const table1 = await val<string>(u, `select public.table_save($1, null, '01', $2, 4::smallint, true, 0)`, [
    tenantId,
    sector,
  ]);
  const table2 = await val<string>(u, `select public.table_save($1, null, '02', $2, 4::smallint, true, 1)`, [
    tenantId,
    sector,
  ]);
  const category = await val<string>(u, `select public.category_save($1, null, 'Pizzas', '', 0, true)`, [tenantId]);
  const pizza = await val<string>(
    u,
    `select public.product_save($1, null, $2, 'Margherita', 'Clássica', 4990, null, true, true, null, null, 0)`,
    [tenantId, category],
  );
  const soda = await val<string>(
    u,
    `select public.product_save($1, null, $2, 'Refrigerante', 'Lata', 700, null, true, true, null, null, 1)`,
    [tenantId, category],
  );
  const cash = await val<string>(u, `select public.payment_method_save($1, null, 'dinheiro', 'Dinheiro', true, null, 0)`, [
    tenantId,
  ]);
  const pix = await val<string>(u, `select public.payment_method_save($1, null, 'pix', 'Pix', true, null, 1)`, [tenantId]);
  const qr = await val<string>(service, 'select qr_token from public.dining_tables where id = $1', [table1]);
  return { sector, table1, table2, category, pizza, soda, cash, pix, qr };
}
