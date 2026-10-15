import { defineConfig } from 'vitest/config';

// Testes de banco (RLS, permissões, fluxos e concorrência) contra o Supabase local.
export default defineConfig({
  test: {
    include: ['tests/db/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
