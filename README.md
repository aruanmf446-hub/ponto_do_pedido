# Ponto do Pedido

SaaS de gestão para restaurantes, com aplicativos independentes em um único projeto
Next.js 16 (App Router, TypeScript estrito), dois projetos Supabase e deploy na
Cloudflare (Workers via OpenNext).

| Área | Rota | Para quem |
| --- | --- | --- |
| Site, planos e Portal do Assinante | `pontodopedido.com/`, `/planos`, `/portal` | Público e assinantes |
| Gestão | `<restaurante>.pontodopedido.com/gestao` | Titular e gestores |
| Atendimento | `/atendimento` | Garçons e atendentes |
| Caixa | `/caixa` | Operadores de caixa |
| Cozinha (Kanban) | `/cozinha` | Produção |
| Administrativo e Financeiro | `/financeiro` | Administrativo |
| Estoque | `/estoque` | Estoquistas |
| Cardápio Digital (QR por mesa) | `/cardapio`, `/cardapio/m/<token>` | Clientes no salão |
| Delivery | `/delivery`, `/delivery/pedido/<token>`, `/delivery/central` | Clientes e equipe |

## Começando

```bash
npm ci
node scripts/local-supabase.mjs start      # Supabase locais: pontodopedido (5432x) e assinaturas (5532x)
node scripts/seed-local.mjs aurora --e2e # restaurante de demonstração (senha Senha12345!)
cp .env.example .env.local                 # preencha com os valores locais exibidos pelo script
npm run dev                                # http://localhost:3000/r/aurora (PDP_PATH_TENANTS=1)
```

## Qualidade

```bash
npm run lint && npm run typecheck   # ESLint (fronteiras entre apps) e TypeScript
npm test                            # unitários (Vitest)
npm run test:db                     # RLS, permissões, fluxos e concorrência no Postgres local
npm run test:e2e                    # Playwright contra o app em execução
npm run cf:build                    # build do Worker Cloudflare
```

## Pendências para publicar

Itens que dependem do titular (não podem ser feitos pelo código):

- [ ] **Publicação na Cloudflare** — no GitHub (Settings → Secrets and variables → Actions):
  - segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`;
  - variáveis públicas `PDP_APP_SUPABASE_URL`, `PDP_APP_SUPABASE_PUBLISHABLE_KEY`,
    `PDP_BILLING_SUPABASE_URL`, `PDP_BILLING_SUPABASE_PUBLISHABLE_KEY` (e opcional `PDP_ROOT_DOMAIN`).
  - Na Cloudflare, a zona `pontodopedido.com` precisa de um registro DNS curinga `*.pontodopedido.com`
    (com proxy ativo), além do domínio raiz.
- [ ] **Auth do Supabase** (projeto pontodopedido) — configurar a Site URL (`https://pontodopedido.com`)
  e as Redirect URLs (`https://pontodopedido.com/**`, `https://*.pontodopedido.com/**`) e decidir a
  política de confirmação de e-mail (e SMTP próprio, se for exigir confirmação).
- [ ] **Banco pontodopedido** — concluir as migrations remotas (ver [estado remoto](docs/supabase-remoto.md)).
- [ ] **Comercial** — os preços aparecem como "Valor sob consulta" e não há provedor de pagamento
  configurado (nenhuma cobrança real é feita) até a decisão do titular.

## Documentação

- [Arquitetura](docs/arquitetura.md)
- [Supabase: projetos, tabelas, RLS e funções](docs/supabase.md) · [estado remoto](docs/supabase-remoto.md)
- [Autenticação, permissões e aprovações](docs/permissoes.md)
- [Modelos visuais](docs/modelos-visuais.md)
- [Deploy na Cloudflare](docs/deploy.md)
- Aplicativos: [docs/apps](docs/apps)
- Regras permanentes para agentes: [CLAUDE.md](CLAUDE.md)
