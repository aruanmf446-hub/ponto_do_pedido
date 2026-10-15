# Deploy na Vercel

Produção: projeto Vercel `ponto_do_pedido`, construído a partir da branch `main` do repositório
`aruanmf446-hub/ponto_do_pedido` pela integração Git da própria Vercel. O GitHub Actions não publica nada.

## Build
- Framework: Next.js 16 (App Router). Comando padrão: `npm run build`.
- Node: 22 (`engines` no `package.json`).

## Variáveis de ambiente (Vercel → Settings → Environment Variables)
- `NEXT_PUBLIC_*` com URL e chave publicável de cada projeto Supabase (app e assinaturas).
  São públicas por desenho; nunca usar `service_role` ou chave secreta.
- Opcionais: domínio raiz e modelo do site institucional, conforme o `src/core/config.ts`.

## Domínio
- `pontodopedido.com` e `*.pontodopedido.com` apontados para a Vercel. Os restaurantes são subdomínios
  e são resolvidos pelo hostname em `src/proxy.ts`.

## Verificação
- Antes de afirmar que a produção está no ar, conferir na Vercel que o último deployment de `main`
  está em `READY` e abrir a URL de produção.
