#!/usr/bin/env node
// Build para Cloudflare Workers (OpenNext).
//
// Next.js 16.4 passou a carregar `.next/server/preview-props.json` ao iniciar.
// @opennextjs/cloudflare 1.20.11 não incorpora esse arquivo no Worker
// (correção publicada em 1.20.12). Até a atualização da dependência, aplicamos
// a MESMA alteração de uma linha do upstream, de forma idempotente.
// Remova este passo ao atualizar para @opennextjs/cloudflare >= 1.20.12.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pkgDir = join(process.cwd(), 'node_modules/@opennextjs/cloudflare');
const { version } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const file = join(pkgDir, 'dist/cli/build/patches/plugins/load-manifest.js');
const source = readFileSync(file, 'utf8');
const original = 'const manifests = await glob(join(dotNextDir, "**/{*-manifest,required-server-files,prefetch-hints}.json"), {';
const patched =
  'const manifests = await glob([join(dotNextDir, "**/{*-manifest,required-server-files,prefetch-hints}.json"), join(dotNextDir, "server/preview-props.json")], {';

if (source.includes('server/preview-props.json')) {
  console.log(`[cf-build] @opennextjs/cloudflare ${version} já incorpora preview-props.json.`);
} else if (source.includes(original)) {
  writeFileSync(file, source.replace(original, patched));
  console.log(`[cf-build] Ajuste de preview-props.json aplicado em @opennextjs/cloudflare ${version}.`);
} else {
  console.error('[cf-build] Versão do OpenNext inesperada: revise scripts/cf-build.mjs.');
  process.exit(1);
}

execFileSync('npx', ['opennextjs-cloudflare', 'build', ...process.argv.slice(2)], { stdio: 'inherit' });
