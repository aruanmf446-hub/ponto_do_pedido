import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Fronteiras entre aplicativos: cada app só importa o núcleo (`@/core`) e o
// próprio código. Um app nunca importa interface ou lógica interna de outro.
const APPS = ['acesso', 'plataforma', 'gestao', 'caixa', 'atendimento', 'cozinha', 'cardapio', 'delivery', 'financeiro', 'estoque'];

const boundaries = APPS.map((app) => ({
  files: [`src/apps/${app}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: APPS.filter((other) => other !== app).flatMap((other) => [`@/apps/${other}`, `@/apps/${other}/*`]),
            message: 'Aplicativos são independentes: compartilhe somente pelo núcleo (@/core).',
          },
        ],
      },
    ],
  },
}));

// Cada grupo de rotas só monta o próprio aplicativo
const routeBoundaries = [
  ['src/app/r/[[]slug]/gestao/**', 'gestao'],
  ['src/app/r/[[]slug]/caixa/**', 'caixa'],
  ['src/app/r/[[]slug]/atendimento/**', 'atendimento'],
  ['src/app/r/[[]slug]/cozinha/**', 'cozinha'],
  ['src/app/r/[[]slug]/cardapio/**', 'cardapio'],
  ['src/app/r/[[]slug]/delivery/**', 'delivery'],
  ['src/app/r/[[]slug]/financeiro/**', 'financeiro'],
  ['src/app/r/[[]slug]/estoque/**', 'estoque'],
].map(([files, app]) => ({
  files: [files],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: APPS.filter((other) => other !== app).flatMap((other) => [`@/apps/${other}`, `@/apps/${other}/*`]),
            message: 'Esta rota pertence a outro aplicativo.',
          },
        ],
      },
    ],
  },
}));

const coreBoundary = {
  files: ['src/core/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', { patterns: [{ group: ['@/apps/*'], message: 'O núcleo não depende de aplicativos.' }] }],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundaries,
  ...routeBoundaries,
  coreBoundary,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@next/next/no-img-element': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    '.open-next/**',
    'next-env.d.ts',
    'backend/**',
    'playwright-report/**',
    'test-results/**',
  ]),
]);

export default eslintConfig;
