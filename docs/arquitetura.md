# Arquitetura

## Visão geral

```
Navegador ──► Vercel (Next.js 16, produção a partir da branch main)
                 │  src/proxy.ts: hostname → restaurante, renova sessão
                 │  Server Components / Server Actions (somente chave publicável + sessão do usuário)
                 ▼
   Supabase pontodopedido (operação + Auth)      Supabase assinaturas (comercial)
   - RLS em todas as tabelas                      - planos, contas, assinaturas, faturas
   - RPCs SECURITY DEFINER com private.authorize  - Edge Function `billing` valida o token
   - Edge Functions `license-sync` e `team`         do usuário no Auth do pontodopedido
   - Storage (tenant-media público, tenant-documents privado), Realtime
```

## Estrutura de código

```
src/
  proxy.ts                 resolução do restaurante por hostname + sessão Supabase
  app/                     rotas (finas): carregam dados e delegam ao aplicativo
    (plataforma)/          site, planos, cadastro, contratação, portal, boas-vindas
    r/[slug]/              restaurante (reescrito a partir do subdomínio)
      gestao/ atendimento/ caixa/ cozinha/ financeiro/ estoque/   internos
      cardapio/ delivery/                                          públicos
  apps/<app>/              cada aplicativo: Shell, páginas, ações, consultas, CSS, fontes, modelos
  core/                    contratos compartilhados: auth, tenant, permissões, rpc, dinheiro, datas,
                           UI semântica (marca, rodapé, diálogo, aprovação, modelo visual, tempo real)
backend/app/supabase       migrations, Edge Functions e config do projeto pontodopedido
backend/billing/supabase   migrations, Edge Function e config do projeto assinaturas
tests/{unit,db,e2e}        Vitest, testes SQL contra o Postgres local e Playwright
```

Fronteiras (ESLint `no-restricted-imports`): um aplicativo não importa outro; `core` não importa
aplicativos; rotas de um aplicativo não importam código de outro.

## Domínios e rotas

- `pontodopedido.com` — site, planos, cadastro, contratação e `/portal`.
- `<slug>.pontodopedido.com` — restaurante. O proxy reescreve para `/r/<slug>/...` e envia
  `x-pdp-tenant` e `x-pdp-base`. O cookie de sessão usa o domínio `.pontodopedido.com`.
- `/r/<slug>/...` direto só quando `PDP_PATH_TENANTS=1` (desenvolvimento e prévias).

## Fluxo de contratação e licença

1. Cadastro do titular no Auth do **pontodopedido** (única autoridade de identidade).
2. Contratação: o Next chama a Edge Function `billing` (assinaturas) com o token do usuário; ela
   valida o token em `/auth/v1/user` do pontodopedido e registra conta/assinatura.
3. `license-sync` (pontodopedido) chama `billing` com o mesmo token, recebe **apenas** as
   assinaturas daquele usuário e aplica `admin_sync_license` (cria/atualiza restaurante, módulos,
   validade, funções padrão). Não há segredo compartilhado entre os projetos.
4. Portal de boas-vindas (assistente) leva às funções da Gestão.

## Tempo real

Publicação Realtime em `tabs`, `orders`, `order_items`, `delivery_orders`, `approval_requests`,
`material_requests` e `cash_sessions`. `LiveRefresh` assina as mudanças (respeitando RLS) e
mantém um *polling* de segurança.
