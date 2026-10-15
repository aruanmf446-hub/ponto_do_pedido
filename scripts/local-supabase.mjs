#!/usr/bin/env node
// Sobe os dois projetos Supabase locais (pontodopedido e assinaturas), conecta
// as redes Docker para que as Edge Functions conversem entre si e grava os
// arquivos .env locais das funções (valores de desenvolvimento, não secretos).
//
// Uso: node scripts/local-supabase.mjs start|stop|status
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
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

if (command === 'start') {
  // Variáveis das funções (lidas na inicialização do Edge Runtime)
  writeFileSync(
    join(projects.app.dir, 'supabase/functions/.env'),
    [
      'PDP_BILLING_URL=http://supabase_kong_assinaturas:8000',
      'PDP_BILLING_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(projects.billing.dir, 'supabase/functions/.env'),
    [
      'PDP_IDENTITY_URL=http://supabase_kong_pontodopedido:8000',
      'PDP_IDENTITY_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
      '',
    ].join('\n'),
  );
  sb(projects.app, ['start', '-x', exclude]);
  sb(projects.billing, ['start', '-x', `${exclude},realtime,storage-api`]);
  connect('supabase_network_assinaturas', 'supabase_kong_pontodopedido');
  connect('supabase_network_pontodopedido', 'supabase_kong_assinaturas');
}

const app = status(projects.app);
const billing = status(projects.billing);
console.log(
  JSON.stringify(
    {
      app: { api: app.API_URL, db: app.DB_URL, publishable: app.PUBLISHABLE_KEY },
      billing: { api: billing.API_URL, db: billing.DB_URL, publishable: billing.PUBLISHABLE_KEY },
    },
    null,
    2,
  ),
);
