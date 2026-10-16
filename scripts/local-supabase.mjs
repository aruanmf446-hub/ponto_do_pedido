#!/usr/bin/env node
// Sobe os dois projetos Supabase locais (pontodopedido e assinaturas), conecta
// as redes Docker para que as Edge Functions conversem entre si e grava os
// arquivos .env locais das funções (valores de desenvolvimento, não secretos).
//
// Uso: node scripts/local-supabase.mjs start|stop|status
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const projects = {
  app: { dir: join(root, 'backend/app'), id: 'pontodopedido' },
  billing: { dir: join(root, 'backend/billing'), id: 'assinaturas' },
};
const exclude = 'studio,logflare,vector,imgproxy,mailpit,supavisor';
const env = { ...process.env, SUPABASE_INTERNAL_IMAGE_REGISTRY: process.env.SUPABASE_INTERNAL_IMAGE_REGISTRY ?? 'docker.io' };

function sb(project, args, opts = {}) {
  return execFileSync('npx', ['supabase', ...args], { cwd: project.dir, env, stdio: opts.capture ? 'pipe' : 'inherit' })
    ?.toString();
}

function status(project) {
  return JSON.parse(sb(project, ['status', '-o', 'json'], { capture: true }));
}

function connect(network, container) {
  try {
    execFileSync('docker', ['network', 'connect', network, container], { stdio: 'pipe' });
  } catch (error) {
    if (!String(error.stderr).includes('already exists')) throw error;
  }
}

const command = process.argv[2] ?? 'start';

if (command === 'stop') {
  for (const p of Object.values(projects)) sb(p, ['stop']);
  process.exit(0);
}

function writeIfChanged(path, content) {
  try {
    if (readFileSync(path, 'utf8') === content) return false;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  writeFileSync(path, content);
  return true;
}

if (command === 'start') {
  // Primeira inicialização: a CLI gera as chaves reais de cada instância.
  // Em seguida, configura a comunicação cruzada e reinicia os runtimes
  // somente se as variáveis das funções foram alteradas.
  for (const p of Object.values(projects)) sb(p, ['start', '-x', p.id === 'pontodopedido' ? exclude : `${exclude},realtime,storage-api`]);
  const appLocal = status(projects.app);
  const billingLocal = status(projects.billing);
  const appKey = appLocal.PUBLISHABLE_KEY ?? appLocal.ANON_KEY;
  const billingKey = billingLocal.PUBLISHABLE_KEY ?? billingLocal.ANON_KEY;
  if (!appKey || !billingKey) throw new Error('As chaves publicáveis locais não estão disponíveis no status da CLI.');

  const appChanged = writeIfChanged(
    join(projects.app.dir, 'supabase/functions/.env'),
    [`PDP_BILLING_URL=http://supabase_kong_assinaturas:8000`,
     `PDP_BILLING_PUBLISHABLE_KEY=${billingKey}`, ''].join('\n'),
  );
  const billingChanged = writeIfChanged(
    join(projects.billing.dir, 'supabase/functions/.env'),
    [`PDP_IDENTITY_URL=http://supabase_kong_pontodopedido:8000`,
     `PDP_IDENTITY_PUBLISHABLE_KEY=${appKey}`, ''].join('\n'),
  );

  if (appChanged || billingChanged) {
    // O runtime lê .env ao iniciar. Um segundo start isolado não o reinicia.
    // Stop/start preserva os volumes locais; nunca usar db reset aqui.
    for (const p of Object.values(projects)) sb(p, ['stop']);
    sb(projects.app, ['start', '-x', exclude]);
    sb(projects.billing, ['start', '-x', `${exclude},realtime,storage-api`]);
  }
  connect('supabase_network_assinaturas', 'supabase_kong_pontodopedido');
  connect('supabase_network_pontodopedido', 'supabase_kong_assinaturas');
}

const app = status(projects.app);
const billing = status(projects.billing);
console.log(
  JSON.stringify(
    {
      app: { api: app.API_URL, publishable_prefix: app.PUBLISHABLE_KEY?.slice(0, 12) },
      billing: { api: billing.API_URL, publishable_prefix: billing.PUBLISHABLE_KEY?.slice(0, 12) },
    },
    null,
    2,
  ),
);
