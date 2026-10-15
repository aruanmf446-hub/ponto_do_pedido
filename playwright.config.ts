import { defineConfig } from '@playwright/test';

// E2E contra o app rodando (local: `npm run build && npm start`) com os dois
// projetos Supabase locais e o restaurante de demonstração (`scripts/seed-local.mjs`).
const executablePath = process.env.PDP_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.PDP_E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: process.env.PDP_E2E_START
    ? { command: 'npm run start', url: 'http://localhost:3000/', reuseExistingServer: true, timeout: 120_000 }
    : undefined,
});
