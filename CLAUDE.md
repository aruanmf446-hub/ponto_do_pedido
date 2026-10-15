# Ponto do Pedido — regras permanentes para agentes

SaaS de gestão para restaurantes: **um projeto Next.js (App Router)** com
aplicativos independentes, dois projetos Supabase e deploy na Vercel (produção).
Leia também `AGENTS.md` (regras do Next.js 16 instaladas pelo framework).

## Fontes da verdade
- Repositório: `aruanmf446-hub/ponto_do_pedido`, branch oficial `main`.
- Supabase **pontodopedido** (`backend/app`): operação, permissões e **autoridade de identidade** (Auth).
- Supabase **assinaturas** (`backend/billing`): planos, contas, assinaturas e faturas.
- Não existe terceiro Supabase. Não reutilizar código dos repositórios antigos.

## Arquitetura (não quebrar)
- `src/apps/<app>`: cada aplicativo tem componentes, layout, CSS, fontes e modelos próprios.
  **Proibido importar de outro `src/apps/*`** (o ESLint bloqueia). Compartilhado só via `src/core`.
- `src/core` nunca importa de `src/apps`.
- Restaurante resolvido pelo hostname em `src/proxy.ts` (`<slug>.pontodopedido.com` → `/r/<slug>/...`).
  `/r/<slug>` direto só com `PDP_PATH_TENANTS=1` (dev/prévias).
- Sem tela de seleção de aplicativos: após o login vai para a área principal autorizada (`landingApp`).

## Segurança e autoridade
- Escritas **somente** por RPCs `SECURITY DEFINER` que chamam `private.authorize(tenant, permissão, valor)`:
  identifica usuário/estabelecimento → módulo → permissão → limite → executa **ou** exige aprovação
  (`APPROVAL_REQUIRED`) → aprovador decide → **revalida** na execução → audita.
- Leituras por RLS (`private.is_member`, `private.can_view_finance`). Toda tabela de `public` tem RLS.
- Aprovação é pontual (não concede poder permanente); permissão revogada deixa de valer;
  ninguém aprova a própria solicitação nem escala o próprio poder.
- Idempotência (`idempotency_key`) em pedidos, pagamentos, movimentações e recebimentos.
- Nunca expor `service_role`/`sb_secret_` no navegador ou no Next.js. As Edge Functions usam segredos
  do próprio Supabase. Variáveis `NEXT_PUBLIC_*` contêm apenas URL e chave publicável.
- ERP externo é apenas **responsabilidade por processo** (`process_ownership`): sem integração,
  sem sincronizadores, filas ou bibliotecas de ERP.

## Identidade visual
- Topo esquerdo: logo e nome do restaurante (`TenantMark`). Rodapé discreto: aplicativo ·
  Ponto do Pedido · © ano · Desenvolvido por crmplus.store (`PlatformFooter`).
- Aplicativos internos: 4 modelos (`data-model="m1".."m4"`) que mudam a **estrutura**, salvos em
  `ui_preferences` por usuário + restaurante + aplicativo. SEO, Cardápio e Delivery: só claro/escuro.
- Responsivo em 390/768/1024/1440 sem rolagem horizontal (há teste E2E).

## Comercial
- Não inventar preços, condições ou dados bancários. Plano sem preço = "Valor sob consulta".
- Não executar cobranças reais. `platform_settings.payment_provider` fica nulo até decisão do titular.
- Não afirmar que a produção está publicada sem verificar o deploy real.

## Fluxo de trabalho
- Mudança de banco: nova migration em `backend/<projeto>/supabase/migrations` (CLI `supabase migration new`).
- Antes de concluir: `npm run lint && npm run typecheck && npm test && npm run test:db && npm run build`
  e, com a stack local, `npm run test:e2e`.
- Local: `node scripts/local-supabase.mjs start` e `node scripts/seed-local.mjs famiglia --e2e`.
- Commits pequenos e descritivos em português; tudo termina na `main`.
