# Deploy na Cloudflare

## Serviço
O pedido cita "Pages". O Cloudflare Pages clássico não executa o runtime do Next.js 16 (App Router,
Server Actions, `proxy.ts`). O modelo compatível é **Cloudflare Workers com Assets** usando o
adaptador oficial **OpenNext** (`@opennextjs/cloudflare`) — é o que este repositório usa.

- `wrangler.jsonc`: Worker `ponto-do-pedido`, rotas `pontodopedido.com/*` e `*.pontodopedido.com/*`.
- `open-next.config.ts`: sem cache incremental (todas as páginas são dinâmicas).
- `npm run cf:build` → `.open-next/`; `npm run cf:preview` roda localmente com `wrangler dev`.
- `.github/workflows/deploy.yml`: publica após o CI verde na `main`, **somente** se existirem:
  - segredos `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`;
  - variáveis `PDP_APP_SUPABASE_URL`, `PDP_APP_SUPABASE_PUBLISHABLE_KEY`,
    `PDP_BILLING_SUPABASE_URL`, `PDP_BILLING_SUPABASE_PUBLISHABLE_KEY` (e opcional `PDP_ROOT_DOMAIN`).

## Pré-requisitos na Cloudflare
1. Zona `pontodopedido.com` na mesma conta.
2. DNS: registro para o domínio raiz e **curinga** `*.pontodopedido.com`, ambos com proxy ativo
   (os restaurantes são subdomínios).
3. Token de API com permissão de Workers Scripts e Workers Routes na zona.

## Limitações conhecidas
- O `proxy.ts` do Next 16 roda como middleware Node; o OpenNext marca esse suporte como
  experimental na Cloudflare. Validado localmente: suíte E2E completa (20/20) no `wrangler dev`.
- `@opennextjs/cloudflare` 1.20.11 não incorpora `preview-props.json` (exigido pelo Next 16.4);
  `scripts/cf-build.mjs` aplica a mesma correção de uma linha publicada na 1.20.12. Remover ao atualizar.
- As variáveis `NEXT_PUBLIC_*` são embutidas no build; alterar URL/chave exige novo build.
- Limites de CPU/memória do plano Workers se aplicam às requisições server-side.
