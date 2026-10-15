#!/usr/bin/env node
// Gera movimento de demonstração (apenas no Supabase LOCAL) para um restaurante
// já criado por `seed-local.mjs`: 14 dias de vendas reais pelo fluxo completo
// (comanda → pedido → cozinha → entrega → caixa), operação em andamento hoje,
// contas, compra e uma aprovação pendente. As datas passadas são ajustadas
// direto no banco local para compor o histórico.
// Uso: node scripts/seed-demo-history.mjs [slug]
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const APP = process.env.SEED_APP_URL ?? 'http://127.0.0.1:54321';
const KEY = process.env.SEED_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const DB = process.env.SEED_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const slug = process.argv[2] ?? 'aurora';
const password = 'Senha12345!';

async function as(who) {
  const client = createClient(APP, KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: `${who}+${slug}@teste.local`, password });
  if (error) throw new Error(`${who}: ${error.message}`);
  return client;
}
const call = (client) => async (fn, args) => {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message} ${error.details ?? ''}`);
  return data;
};

const db = new pg.Client({ connectionString: DB });
await db.connect();
const { rows: [tenantRow] } = await db.query('select id from public.tenants where slug = $1', [slug]);
if (!tenantRow) throw new Error(`Restaurante ${slug} não encontrado`);
const tenant = tenantRow.id;

const garcom = call(await as('garcom'));
const cozinha = call(await as('cozinha'));
const caixa = call(await as('caixa'));
const adm = call(await as('adm'));
const dono = call(await as('dono'));

const { rows: tables } = await db.query('select id, label from public.dining_tables where tenant_id = $1 order by position', [tenant]);
const { rows: products } = await db.query('select id, name, price_cents from public.products where tenant_id = $1 and active', [tenant]);
const { rows: methods } = await db.query('select id, kind from public.payment_methods where tenant_id = $1 and active order by position', [tenant]);

let seq = 0;
const key = (p) => `demo-${p}-${Date.now()}-${seq++}`;
const pick = (list, n) => [...list].sort(() => Math.random() - 0.5).slice(0, n);
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

await caixa('cash_session_open', { p_tenant: tenant, p_opening_cents: 20000, p_idempotency_key: key('cash') }).catch((e) => {
  if (!String(e.message).includes('CASH_ALREADY_OPEN')) throw e;
});

/** Comanda completa até o pagamento. Retorna os ids criados. */
async function fullTab(table) {
  const tab = await garcom('tab_open', { p_tenant: tenant, p_table: table.id, p_customer_name: null, p_guest_count: rand(1, 4), p_idempotency_key: key('tab') });
  const items = pick(products, rand(2, 4)).map((p) => ({ product_id: p.id, quantity: rand(1, 2) }));
  const created = await garcom('order_create', { p_tenant: tenant, p_tab: tab.id, p_items: items, p_notes: null, p_idempotency_key: key('order') });
  const order = created.order;
  await cozinha('kitchen_advance', { p_tenant: tenant, p_order: order.id, p_to: 'preparing', p_stage: null });
  await cozinha('kitchen_advance', { p_tenant: tenant, p_order: order.id, p_to: 'ready', p_stage: null });
  await garcom('order_deliver', { p_tenant: tenant, p_order: order.id, p_context: 'atendimento' });
  const { rows: [t] } = await db.query('select total_cents - paid_cents as balance from public.tabs where id = $1', [tab.id]);
  const method = methods[rand(0, methods.length - 1)];
  const amount = Number(t.balance);
  await caixa('payment_register', {
    p_tenant: tenant, p_tab: tab.id, p_method: method.id, p_amount_cents: amount,
    p_tendered_cents: method.kind === 'dinheiro' ? Math.ceil(amount / 1000) * 1000 : null,
    p_payer_label: null, p_context: 'caixa', p_idempotency_key: key('pay'),
  });
  return { tab: tab.id, order: order.id };
}

// Histórico: 13 dias anteriores
for (let back = 13; back >= 1; back -= 1) {
  const count = rand(4, 9);
  const ids = [];
  for (let i = 0; i < count; i += 1) ids.push(await fullTab(tables[i % tables.length]));
  const tabIds = ids.map((x) => x.tab);
  const orderIds = ids.map((x) => x.order);
  const shift = `${back} days`;
  await db.query(
    `update public.tabs set business_day = business_day - $2::int, opened_at = opened_at - $3::interval, closed_at = closed_at - $3::interval where id = any($1)`,
    [tabIds, back, shift],
  );
  await db.query(
    `update public.orders set business_day = business_day - $2::int, created_at = created_at - $3::interval, confirmed_at = confirmed_at - $3::interval,
       started_at = started_at - $3::interval - interval '12 minutes', ready_at = ready_at - $3::interval, delivered_at = delivered_at - $3::interval
     where id = any($1)`,
    [orderIds, back, shift],
  );
  await db.query(`update public.payments set business_day = business_day - $2::int, received_at = received_at - $3::interval where tab_id = any($1)`, [tabIds, back, shift]);
}
// Tempo de preparo realista para hoje também
await db.query(`update public.orders set started_at = started_at - interval '14 minutes' where tenant_id = $1 and started_at is not null`, [tenant]);

// Hoje: vendas concluídas + operação em andamento
for (let i = 0; i < 5; i += 1) await fullTab(tables[i]);
const live = tables.slice(5, 10);
const states = ['confirmed', 'preparing', 'ready', 'delivered', 'bill'];
for (const [i, table] of live.entries()) {
  const tab = await garcom('tab_open', { p_tenant: tenant, p_table: table.id, p_customer_name: null, p_guest_count: rand(2, 5), p_idempotency_key: key('tab') });
  const items = pick(products, rand(2, 4)).map((p) => ({ product_id: p.id, quantity: rand(1, 2) }));
  const { order } = await garcom('order_create', { p_tenant: tenant, p_tab: tab.id, p_items: items, p_notes: i === 1 ? 'Sem cebola' : null, p_idempotency_key: key('order') });
  const state = states[i];
  if (state !== 'confirmed') await cozinha('kitchen_advance', { p_tenant: tenant, p_order: order.id, p_to: 'preparing', p_stage: 'Preparo' });
  if (state === 'ready' || state === 'delivered' || state === 'bill') await cozinha('kitchen_advance', { p_tenant: tenant, p_order: order.id, p_to: 'ready', p_stage: null });
  if (state === 'delivered' || state === 'bill') await garcom('order_deliver', { p_tenant: tenant, p_order: order.id, p_context: 'atendimento' });
  if (state === 'bill') await garcom('tab_request_bill', { p_tenant: tenant, p_tab: tab.id, p_forward_to_cashier: false });
  await db.query(`update public.orders set created_at = now() - ($2::int * interval '7 minutes'), confirmed_at = now() - ($2::int * interval '7 minutes') where id = $1`, [order.id, i + 1]);
}

// Administrativo: contas, recebível, compra com cotação
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const plus = (n) => iso(new Date(today.getTime() + n * 86_400_000));
const { rows: suppliers } = await db.query('select id, name from public.suppliers where tenant_id = $1 order by name', [tenant]);
for (const [desc, cat, cents, due, sup] of [
  ['Aluguel do salão', 'Ocupação', 650000, plus(5), null],
  ['Energia elétrica', 'Utilidades', 128900, plus(-2), null],
  ['Laticínios da semana', 'Compras', 84350, plus(1), suppliers[1]?.id ?? null],
  ['Internet e telefone', 'Utilidades', 18990, plus(12), null],
]) {
  await adm('payable_create', {
    p_tenant: tenant, p_kind: 'conta', p_supplier: sup, p_description: desc, p_category: cat, p_amount_cents: cents,
    p_due_date: due, p_document: null, p_idempotency_key: key('payable'),
  });
}
await adm('receivable_save', { p_tenant: tenant, p_customer: 'Empresa Horizonte', p_description: 'Almoço corporativo (fatura)', p_amount_cents: 245000, p_due_date: plus(9) });
const pr = await adm('purchase_request_create', {
  p_tenant: tenant, p_justification: 'Reposição semanal de hortifrúti', p_needed_by: plus(3),
  p_items: [{ material_id: null, description: 'Hortifrúti variado', quantity: 1, unit: 'cx' }],
});
if (suppliers[0]) {
  await adm('quotation_add', {
    p_tenant: tenant, p_request: pr, p_supplier: suppliers[0].id, p_total_cents: 32000, p_delivery_days: 2,
    p_valid_until: plus(7), p_payment_terms: '7 dias', p_notes: null, p_document: null,
  });
}

// Aprovação pendente: desconto acima do limite do caixa
const { rows: [openTab] } = await db.query(`select id, number from public.tabs where tenant_id = $1 and status = 'open' order by opened_at desc limit 1`, [tenant]);
if (openTab) {
  await caixa('approval_request_create', {
    p_tenant: tenant, p_permission: 'caixa.desconto', p_action_kind: 'tab.discount',
    p_summary: `Desconto de R$ 25,00 na comanda ${openTab.number}`, p_amount_cents: 2500,
    p_payload: { tab_id: openTab.id, discount_cents: 2500, reason: 'Cliente frequente' }, p_reason: 'Cliente frequente',
  });
}
// Onboarding concluído para o painel ficar limpo
await dono('onboarding_finish', { p_tenant: tenant }).catch(() => {});

const { rows: [summary] } = await db.query(
  `select (select count(*) from public.tabs where tenant_id = $1) tabs, (select coalesce(sum(amount_cents),0) from public.payments where tenant_id = $1) revenue`,
  [tenant],
);
await db.end();
console.log(JSON.stringify({ slug, ...summary }));
