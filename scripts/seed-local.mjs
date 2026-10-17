#!/usr/bin/env node
// Cria um restaurante de demonstração nos Supabase LOCAIS seguindo o fluxo real:
// cadastro do titular → contratação (assinaturas) → sincronização da licença →
// cadastros via RPC → equipe via Edge Function `team`.
// Uso: node scripts/seed-local.mjs [slug] [--e2e]
// --e2e: dispensa a troca de senha do primeiro acesso (apenas no banco LOCAL de testes).
import { confirmLocalPayment } from './confirm-local-payment.mjs';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = process.env.SEED_APP_URL ?? 'http://127.0.0.1:54321';
const BILLING = process.env.SEED_BILLING_URL ?? 'http://127.0.0.1:55321';
// Recusa destinos remotos antes do primeiro cadastro ou chamada comercial.
for (const [value, port] of [[APP, '54321'], [BILLING, '55321']]) {
  const url = new URL(value);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.port !== port) {
    throw new Error('Seed permitido somente nas duas stacks Supabase locais.');
  }
}
// Cada instância Supabase gera sua própria chave publicável.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function localPublishableKey(project) {
  const cwd = join(root, 'backend', project);
  const info = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { cwd, encoding: 'utf8' }));
  const key = info.PUBLISHABLE_KEY ?? info.ANON_KEY;
  if (!key) throw new Error(`Chave publicável local ausente no projeto ${project}.`);
  return key;
}
const APP_KEY = process.env.SEED_APP_PUBLISHABLE_KEY ?? localPublishableKey('app');
const BILLING_KEY = process.env.SEED_BILLING_PUBLISHABLE_KEY ?? localPublishableKey('billing');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const e2e = process.argv.includes('--e2e');
const slug = args[0] ?? `aurora${Date.now().toString(36).slice(-5)}`;
const password = 'Senha12345!';
const ownerEmail = `dono+${slug}@teste.local`;

async function call(url, token, body, key) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json?.error) throw new Error(`${url}: ${JSON.stringify(json)}`);
  return json;
}

const supabase = createClient(APP, APP_KEY, { auth: { persistSession: false } });
const { data: signUp, error } = await supabase.auth.signUp({ email: ownerEmail, password, options: { data: { full_name: 'Helena Prado' } } });
if (error) throw error;
let token = signUp.session?.access_token;
if (!token && signUp.user?.id) {
  // Fixture de demonstração apenas LOCAL. Confirma este cadastro, sem alterar
  // a política de Auth; o teste de segurança usa os e-mails reais do Mailpit.
  const info = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
    cwd: join(root, 'backend/app'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const admin = createClient(APP, info.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const confirmed = await admin.auth.admin.updateUserById(signUp.user.id, { email_confirm: true });
  if (confirmed.error) throw new Error('Falha ao confirmar a fixture local.');
  const signed = await supabase.auth.signInWithPassword({ email: ownerEmail, password });
  if (signed.error) throw new Error('Falha ao entrar com a fixture local.');
  token = signed.data.session?.access_token;
}
if (!token) throw new Error('Cadastro local sem sessão.');

const subscribed = await call(`${BILLING}/functions/v1/billing`, token, {
  action: 'subscribe',
  plan_code: 'diamond',
  restaurant_name: 'Bistrô Aurora',
  restaurant_slug: slug,
  accept_terms: true,
  idempotency_key: slug,
}, BILLING_KEY);
if (subscribed.status !== 'pending_payment') throw new Error('Contratação local deveria aguardar pagamento.');
await confirmLocalPayment(subscribed.subscription_id, APP, BILLING);
const sync = await call(`${APP}/functions/v1/license-sync`, token, {}, APP_KEY);
const tenant = sync.results.find((r) => r.slug === slug)?.tenant_id;
if (!tenant) throw new Error(`Licença não sincronizada: ${JSON.stringify(sync)}`);

async function rpc(fn, args) {
  const { data, error: e } = await supabase.rpc(fn, args);
  if (e) throw new Error(`${fn}: ${e.message}`);
  return data;
}

const salao = await rpc('sector_save', { p_tenant: tenant, p_id: null, p_name: 'Salão Principal', p_kind: 'salao', p_active: true, p_position: 0 });
const varanda = await rpc('sector_save', { p_tenant: tenant, p_id: null, p_name: 'Varanda', p_kind: 'salao', p_active: true, p_position: 1 });
for (let i = 1; i <= 12; i += 1) {
  await rpc('table_save', {
    p_tenant: tenant, p_id: null, p_label: String(i).padStart(2, '0'), p_sector: i <= 8 ? salao : varanda,
    p_seats: i % 3 === 0 ? 6 : i % 2 === 0 ? 2 : 4, p_active: true, p_position: i,
  });
}
const cats = {};
const categoryNames = ['Pratos principais', 'Lanches', 'Saladas', 'Massas', 'Porções', 'Bebidas', 'Cafés', 'Sobremesas'];
for (const [i, name] of categoryNames.entries()) {
  cats[name] = await rpc('category_save', { p_tenant: tenant, p_id: null, p_name: name, p_description: '', p_position: i, p_active: true });
}
const products = [
  ['Pratos principais', 'Filé grelhado', 'Filé ao ponto, arroz de ervas e legumes salteados', 6890],
  ['Pratos principais', 'Frango à parmegiana', 'Empanado, molho de tomate e queijo gratinado', 4790],
  ['Pratos principais', 'Salmão com risoto', 'Salmão grelhado e risoto de limão-siciliano', 7490],
  ['Pratos principais', 'Prato executivo do dia', 'Arroz, feijão, proteína do dia e salada', 3290],
  ['Lanches', 'Burger da casa', 'Pão brioche, blend 180 g, queijo e cebola caramelizada', 3890],
  ['Lanches', 'Sanduíche natural', 'Pão integral, frango, cenoura e requeijão', 2290],
  ['Saladas', 'Salada Caesar', 'Alface romana, frango, croutons e parmesão', 3190],
  ['Saladas', 'Bowl vegano', 'Grão-de-bico, quinoa, legumes assados e tahine', 3490],
  ['Massas', 'Espaguete ao sugo', 'Molho de tomate artesanal e manjericão', 3890],
  ['Massas', 'Lasanha à bolonhesa', 'Massa fresca, ragu e bechamel', 4290],
  ['Porções', 'Batata frita rústica', 'Com alecrim e maionese da casa', 2490],
  ['Porções', 'Pizza margherita individual', 'Tomate, mussarela e manjericão', 3990],
  ['Bebidas', 'Suco natural', 'Laranja, limão ou abacaxi com hortelã', 1190],
  ['Bebidas', 'Refrigerante lata', '350 ml', 700],
  ['Bebidas', 'Água com gás', '500 ml', 600],
  ['Cafés', 'Cappuccino', 'Espresso, leite vaporizado e canela', 1290],
  ['Cafés', 'Espresso', 'Grãos especiais torrados na casa', 790],
  ['Sobremesas', 'Torta de limão', 'Base crocante e merengue maçaricado', 1890],
  ['Sobremesas', 'Brownie com sorvete', 'Chocolate meio amargo e creme', 2290],
];
for (const [i, [cat, name, description, price]] of products.entries()) {
  await rpc('product_save', {
    p_tenant: tenant, p_id: null, p_category: cats[cat], p_name: name, p_description: description, p_price_cents: price,
    p_image_path: null, p_available: true, p_active: true, p_channels: null, p_prep_sector: null, p_position: i,
  });
}
for (const [i, [kind, name]] of [['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['credito', 'Crédito'], ['debito', 'Débito']].entries()) {
  await rpc('payment_method_save', { p_tenant: tenant, p_id: null, p_kind: kind, p_name: name, p_active: true, p_channels: null, p_position: i });
}
await rpc('delivery_zone_save', { p_tenant: tenant, p_id: null, p_name: 'Centro', p_neighborhoods: ['Centro'], p_fee_cents: 800, p_min_order_cents: 3000, p_eta_minutes: 45, p_active: true });
// Cada área de configuração é salva (e autorizada) separadamente
await rpc('tenant_update_settings', { p_tenant: tenant, p_patch: { delivery_enabled: true } });
await rpc('tenant_update_settings', { p_tenant: tenant, p_patch: { local_order_mode: 'ambos', local_order_confirmation: 'atendente' } });
await rpc('tenant_update_settings', { p_tenant: tenant, p_patch: { service_fee_percent: 10, kitchen_stages: ['Preparo', 'Montagem', 'Finalização'] } });

// Estoque e suprimentos de demonstração
const deposito = await rpc('stock_location_save', { p_tenant: tenant, p_id: null, p_name: 'Depósito seco', p_kind: 'deposito', p_parent: null, p_active: true });
const camara = await rpc('stock_location_save', { p_tenant: tenant, p_id: null, p_name: 'Câmara fria', p_kind: 'camara_fria', p_parent: null, p_active: true });
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const materiais = [
  ['Farinha de trigo 00', 'Secos', 'kg', 20, 25, false, deposito, 40, null, 590],
  ['Muçarela', 'Laticínios', 'kg', 8, 10, true, camara, 6, day(5), 3890],
  ['Tomate pelado', 'Secos', 'kg', 10, 12, false, deposito, 18, day(120), 1250],
  ['Manjericão', 'Hortifruti', 'un', 10, 20, true, camara, 12, day(-1), 300],
  ['Azeite extravirgem', 'Secos', 'l', 4, 6, false, deposito, 9, day(300), 4200],
];
for (const [name, category, unit, min, reorder, perishable, location, qty, expires, cost] of materiais) {
  const id = await rpc('material_save', { p_tenant: tenant, p_id: null, p_name: name, p_category: category, p_unit: unit, p_sku: null, p_min_qty: min, p_reorder_qty: reorder, p_perishable: perishable, p_active: true });
  await rpc('stock_entry', { p_tenant: tenant, p_material: id, p_location: location, p_qty: qty, p_lot_code: `L${String(qty).padStart(3, '0')}`, p_expires_on: expires, p_unit_cost_cents: cost, p_reason: 'Saldo inicial', p_idempotency_key: `seed-${name}` });
}
await rpc('supplier_save', { p_tenant: tenant, p_id: null, p_name: 'Laticínios Serra Azul', p_document: null, p_contact_name: 'Carla', p_phone: null, p_email: null, p_notes: null, p_active: true });
await rpc('supplier_save', { p_tenant: tenant, p_id: null, p_name: 'Empório Atacadista', p_document: null, p_contact_name: null, p_phone: null, p_email: null, p_notes: null, p_active: true });

const { data: roles } = await supabase.from('roles').select('id, name').eq('tenant_id', tenant);
const roleId = (n) => roles.find((r) => r.name === n).id;
const staff = [
  ['garcom', 'Lucas Garçom', 'atendimento', ['Atendente']],
  ['cozinha', 'Ana Cozinha', 'cozinha', ['Cozinha']],
  ['caixa', 'Paula Caixa', 'caixa', ['Caixa']],
  ['gestora', 'Júlia Gestora', 'gestao', ['Gestor']],
  ['adm', 'Rafael Administrativo', 'financeiro', ['Administrativo']],
  ['estoque', 'Bruno Estoque', 'estoque', ['Estoquista']],
];
const accounts = { owner: ownerEmail };
for (const [key, name, app, roleNames] of staff) {
  const email = `${key}+${slug}@teste.local`;
  await call(`${APP}/functions/v1/team`, token, {
    tenant_id: tenant, email, full_name: name, job_title: roleNames[0], primary_app: app,
    role_ids: roleNames.map(roleId), temporary_password: password,
  }, APP_KEY);
  accounts[key] = email;
}
if (e2e) {
  const { default: pg } = await import('pg');
  const db = new pg.Client({ connectionString: process.env.SEED_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
  await db.connect();
  await db.query('update public.memberships set must_change_password = false where tenant_id = $1', [tenant]);
  await db.end();
}
console.log(JSON.stringify({ slug, tenant, password, accounts }, null, 2));
