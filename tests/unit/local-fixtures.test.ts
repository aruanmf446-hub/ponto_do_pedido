import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('seed recusa produção antes de tentar cadastro ou pagamento', () => {
  const result = spawnSync(process.execPath, ['scripts/seed-local.mjs', 'unit'], {
    env: { ...process.env, SEED_APP_URL: 'https://qmhtzosfbosgolevnybd.supabase.co' },
    encoding: 'utf8',
    timeout: 5000,
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Seed permitido somente nas duas stacks Supabase locais.');
});
