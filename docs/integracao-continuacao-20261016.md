# Continuação da integração — 16/10/2026, UTC

> Complemento posterior: [billing central multiproduto CRM PLUS](./billing-multiproduto-20261016.md).

Continuação do relatório `integracao-20261016.md`, a partir de `c9e78ed`.
As evidências anteriores permanecem preservadas. Este documento distingue os
testes reais em produção dos testes das stacks locais no CI.

## Evidências reais de autenticação e produção

Foi usada exclusivamente a identidade de teste autorizada pelo titular. A
senha temporária e os tokens não foram impressos, versionados ou publicados.

- Cadastro pelo formulário oficial da Vercel: criou uma conta e exigiu confirmação
  de e-mail. O clique do titular confirmou a conta, comprovado no Auth do app.
- Falha real no retorno do e-mail: o link encaminhou para `localhost:3000`.
  Uma chamada pública de verificação com token deliberadamente inválido também
  confirmou o fallback por HTTP 303 para `http://localhost:3000`, inclusive quando
  solicitado o callback de produção. Nenhuma confirmação foi desabilitada.
- Login correto, recarga, redirecionamento para Portal e contratação: aprovados
  no Chromium com 390 px e 1440 px. O JWT da sessão possui issuer exatamente
  `https://qmhtzosfbosgolevnybd.supabase.co/auth/v1`; nenhum token foi exibido.
- Senha incorreta: mensagem de erro e Portal bloqueado nos dois tamanhos.
- Logout: Portal voltou a exigir login e o refresh token foi recusado. Teste
  adicional com o access token anterior ao logout recebeu 401 no license-sync.
- Cadastro repetido com o mesmo e-mail: resposta genérica de confirmação do
  Supabase, sem criar segunda conta; a única conta continuou confirmada.
- Billing overview com sessão válida: 200, sem assinaturas e sem conta comercial.
- License-sync manual v1 com sessão válida: 200 e `results: []`, repetidamente.
  Sem token ou com token inválido: 401. Não houve restaurante criado.
- Billing v4 com sessão válida e tentativa real de contratação: 503,
  `PAYMENT_CONFIRMATION_REQUIRED`, nos dois tamanhos de tela. Contagens finais:
  zero contas comerciais, assinaturas, contratos, faturas e restaurantes.
- Callback novo sem verifier PKCE: permanece no domínio oficial, remove o código
  da URL de destino e pede login sem presumir confirmação. Depois do login, o
  destino `/contratar` foi respeitado e os três planos oficiais apareceram.
- `/r/pdp-audit-20261016` permaneceu 404: nenhuma licença/restaurante foi fabricada.
- Sete testes Playwright públicos passaram: formulários, controle de acesso,
  três preços e login negativo/responsividade em 390/1440. Os testes de sessão e
  callback acima também foram executados com Chromium real, sem mocks.

## Correções e publicação

### Segurança comercial

`backend/billing/supabase/functions/billing/index.ts` agora exige que a RPC
`billing_checkout_policy` comprove a política segura antes de contratar. Se a
migração ainda não existe, falha de modo fechado, antes de gravar a assinatura.
Renovação e alteração de plano retornam PAYMENT_REQUIRED sem liberar período ou
módulos. O resultado idempotente é recuperado antes de rejeitar um slug que já
foi provisionado, sempre com a identidade validada no Auth.

Billing remoto: **v4 ACTIVE**, verify_jwt=false preservado, com validação interna
de identidade. Os arquivos implantados foram obtidos novamente e comparados
com os arquivos enviados: iguais desconsiderando newline final. Hash do bundle:
`b64fc5b9839466ff62bccae0186377c077cc86c1ac5988e0a6266a2b398995ba`.
License-sync manual v1 foi preservado, hash
`255c945c3dca94242d3883d13abeff25768a88d93135b99004b350ebe80b16a5`.

Migração preparada, **NÃO APLICADA REMOTAMENTE**, aguardando autorização específica:
`backend/billing/supabase/migrations/20261016213840_require_confirmed_payment.sql`.

- Toda nova assinatura nasce pending_payment, sem período ativo, qualquer que
  seja o activation_mode ou o provedor. A fatura permanece aberta.
- Renovação/upgrade exigem pagamento. Não altera os settings, preços, Auth,
  assinaturas ou faturas existentes.
- Lock transacional da chave de idempotência impede duas requisições concorrentes
  da mesma contratação de criarem faturas/contratos extras.
- RPCs auxiliares são exclusivas de service_role. O navegador não pode chamá-las.
- Os três planos continuam em 4999, 8000 e 15000 centavos.

O seed foi adaptado para exigir o evento de pagamento confirmado e a fatura paga
somente nas stacks LOCAIS, sem chamada à API do Mercado Pago. Destinos remotos
são recusados antes do primeiro cadastro. Essa fixture não é prova de pagamento
em produção e nunca foi executada contra os projetos remotos.

### Confirmação em outro navegador e redirecionamento

`src/core/auth/confirm.ts` agora permite continuar por login quando o código não
pode abrir sessão, como ocorre sem o verifier PKCE em outro navegador. Não
concede sessão nem afirma que o e-mail foi confirmado. `safeAuthNext` recusa
URLs externas, barras invertidas e caracteres de controle; login e ações usam
a mesma validação. Testes cobrem código/hash válidos, inválidos e redirecionamentos.

**Configuração de URLs remota ainda pendente:** o conector Supabase desta sessão
não oferece leitura/edição de Auth config; a CLI respondeu `Access token not
provided`. Não foi tentado contornar esse limite por SQL ou extrair credenciais.
O titular foi orientado a ajustar exclusivamente, no projeto app:

- Site URL: `https://pontodopedido.vercel.app`
- Redirect URL adicional: `https://pontodopedido.vercel.app/**`
- Manter confirmação de e-mail habilitada.

Página exata: <https://supabase.com/dashboard/project/qmhtzosfbosgolevnybd/auth/url-configuration>.
O código já solicita `/auth/confirm?next=...` na origem da aplicação; ele não pode
substituir a allowlist/configuração do serviço Auth. Não declarar o link recebido
por e-mail corrigido enquanto esse ajuste remoto não for comprovado.

## Cloudflare e Vercel

O check Cloudflare é originado pelo gatilho
`baab0482-e965-41fc-85fa-cfe592e9c757`, ligado à main de ponto_do_pedido:
build `npm run cf:build`, deploy `npm run cf:deploy`. Ambos não pertencem ao
projeto oficial atual. Build consultado: `e2df8d31-fcfc-4f18-9fe9-5f6b611c91af`,
falhou por script ausente. Não há domínio customizado associado a esse Worker,
mas seu workers.dev e previews estão habilitados; portanto, não há comprovação
de que o recurso esteja sem uso.

Pendência concreta: revisar e desvincular o gatilho antigo se o titular confirmar
que o destino adicional não é utilizado. Nenhum Worker, domínio ou recurso foi
excluído; não foi adicionado cf:build falso nem uma segunda arquitetura.

Production e Preview da Vercel foram conferidos: URL e chave pública do app
apontam ao ref qmhtzosfbosgolevnybd; billing aponta a bjtlookhgkdltdohzxnq;
PDP_PATH_TENANTS=1. Deploy de código `2dcc334` READY no domínio oficial.

## Testes e CI

- Lint e TypeScript locais: aprovados.
- Unitários locais: **64 aprovados**, 13 arquivos.
- Build local e Vercel: aprovados.
- `npm run test:db` neste executor: conexão recusada nos bancos locais, 14 falhas
  e 38 testes pulados. A stack continua indisponível após o bloqueio de espaço
  do Docker já registrado no relatório anterior. Validação de banco via CI.
- CI `38971181114`, primeiro intento: **52 testes de banco aprovados**, inclusive
  três planos pendentes sem provedor, concorrência e fatura/contrato únicos.
  Seed local aprovado. O segundo build falhou no resolvedor next/font/google
  do Turbopack (Outfit), antes do E2E. Não foi alterada a fonte nem a landing.
  A execução posterior passou nesse mesmo build.
- [CI final 38971960223](https://github.com/aruanmf446-hub/ponto_do_pedido/actions/runs/38971960223):
  **APROVADO** no código `2dcc334`: lint, tipos, 64 unitários, build,
  **52 testes de banco e 28 E2E**. Os 7 testes públicos de produção ficaram
  pulados apenas na suíte local opt-in; passaram separadamente contra a Vercel.

## Matriz de conclusão

| Fluxo | Resultado | Evidência |
| --- | --- | --- |
| Cadastro real | REPROVADO | Conta criada e confirmada; retorno do e-mail ainda aponta a localhost. |
| Login e sessão | APROVADO | Login, recarga, destino, logout e revogação reais em 390/1440. |
| Billing | NÃO TESTADO | Catálogo, overview autenticado e bloqueio seguro aprovados. Contratação/fatura reais pendentes da migração autorizada. |
| License-sync | NÃO TESTADO | Sessão válida sem assinatura, repetição e negativas passaram; falta licença ativa com tenant e titular correspondentes em produção. |
| Criação de restaurante | NÃO TESTADO | Nenhum pagamento confirmado ou licença artificialmente ativa em produção. |
| Acesso aos aplicativos | NÃO TESTADO | Não há restaurante/licença ativa de teste em produção; rota inexistente permaneceu bloqueada. |
| Isolamento A/B | NÃO TESTADO | Somente uma identidade foi autorizada; não foi inventada uma segunda conta. |
| Proteção contra acesso sem pagamento | APROVADO | Contratação real recebe 503 e não grava registros; migração preparada/testada localmente e ainda não aplicada remotamente. |
| Cloudflare | REPROVADO | Gatilho antigo usa scripts inexistentes; recurso workers.dev habilitado preservado. |
| CI | APROVADO | CI 38971960223: 64 unitários, 52 de banco, 28 E2E, lint, tipos e build. |
| Vercel produção | APROVADO | Deploy READY do código da main e testes reais no domínio oficial. |

Não houve cobrança, ativação do Mercado Pago, alteração de preços, desativação
de confirmação/RLS, migração financeira remota ou exclusão de clientes.

## Commits desta continuação

- `81590c3`: confirmação de pagamento, bloqueio em banco legado, idempotência e fixtures locais seguras.
- `3e0820e`: login negativo e formulários de produção em mobile/desktop.
- `2dcc334`: callback em outro navegador e validação segura dos redirecionamentos.

A atualização final de documentação usa `[skip ci]`, pois não altera o código
validado acima. O deploy final da documentação deve ser conferido no encerramento.

## Pendências exatas

1. Corrigir Site URL/Redirect URL no Auth pelo painel ou por uma conexão com
   capacidade de gerenciamento de Auth. O ajuste já foi autorizado pelo titular
   ao solicitar a correção do retorno para localhost; falta capacidade técnica
   nesta conexão para executá-lo. Nenhum secret deve ser enviado em chat.
2. Autorização específica para aplicar a migração financeira preparada. Até lá,
   a API de contratação permanece bloqueada com segurança.
3. Segunda identidade autorizada para teste remoto A/B. Licença ativa e apps
   em produção não foram fabricados nem liberados sem pagamento confirmado.
4. Rever/desvincular o gatilho Cloudflare antigo após confirmar seu uso; não
   excluir o Worker habilitado indiscriminadamente.
