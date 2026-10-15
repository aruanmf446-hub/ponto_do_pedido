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
node scripts/seed-local.mjs famiglia --e2e # restaurante de demonstração (senha Senha12345!)
cp .env.example .env.local                 # preencha com os valores locais exibidos pelo script
npm run dev                                # http://localhost:3000/r/famiglia (PDP_PATH_TENANTS=1)
```

## Qualidade

```bash
npm run lint && npm run typecheck   # ESLint (fronteiras entre apps) e TypeScript
npm test                            # unitários (Vitest)
npm run test:db                     # RLS, permissões, fluxos e concorrência no Postgres local
npm run test:e2e                    # Playwright contra o app em execução
npm run cf:build                    # build do Worker Cloudflare
```

## Documentação

- [Arquitetura](docs/arquitetura.md)
- [Supabase: projetos, tabelas, RLS e funções](docs/supabase.md) · [estado remoto](docs/supabase-remoto.md)
- [Autenticação, permissões e aprovações](docs/permissoes.md)
- [Modelos visuais](docs/modelos-visuais.md)
- [Deploy na Cloudflare](docs/deploy.md)
- Aplicativos: [docs/apps](docs/apps)
- Regras permanentes para agentes: [CLAUDE.md](CLAUDE.md)
