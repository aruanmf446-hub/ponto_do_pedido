# Auditoria da integração — 16/10/2026 (UTC)

> Continuação com autenticação real e proteção comercial:
> [integração — continuação de 16/10/2026](./integracao-continuacao-20261016.md).
> O relatório abaixo preserva as evidências do primeiro trabalho.

**Conclusão: NÃO TESTADO o fluxo autenticado completo.** Não há identidade de
teste autorizada disponível: o Auth remoto possui zero usuários. Não foi criada
identidade fictícia, assinatura, restaurante ou cobrança em produção. Não há
evidência para declarar resolvido o `AUTH_REQUIRED` com uma sessão válida.

## Evidências remotas

| Item | Classificação | Evidência |
| --- | --- | --- |
| Projetos oficiais | APROVADO | `qmhtzosfbosgolevnybd` é pontodopedido/Auth; `bjtlookhgkdltdohzxnq` é assinaturas. Ambos ACTIVE_HEALTHY. |
| Migrações | APROVADO (inventário) | App: 14 entradas, incluindo as 11 operacionais; billing: 4, incluindo Mercado Pago, confirmação e preços. Não reaplicadas. |
| Cadastro/login/sessão válidos | NÃO TESTADO | Zero usuários no Auth, sem caixa de e-mail de teste autorizada. Formulários renderizam, mas isso não comprova cadastro/login. |
| Portal sem sessão | APROVADO | Playwright real redireciona `/portal` para `/entrar?next=/portal`; `/contratar` para `/cadastro`. |
| Catálogo e preços | APROVADO | REST do billing 200 e página `/planos` no Chromium: START 4999, PLUS 8000, DIAMOND 15000 centavos. |
| Contratação remota | NÃO TESTADO | Zero assinaturas/faturas. `activation_mode=immediate`, `payment_provider=null`: criar assinatura ativaria sem comprovar pagamento. Configurações preservadas. |
| License-sync sem token/inválido | APROVADO | Ambas as chamadas HTTP reais retornam 401 e `AUTH_REQUIRED`. Mesmo resultado em billing e team. |
| License-sync com sessão válida | NÃO TESTADO | Depende da identidade autorizada. Não foi usado JWT fabricado nem simulação como prova remota. |
| Restaurante, módulos e repetição de sync | NÃO TESTADO | Zero restaurantes. Revisão confirma owner validado, módulos vindos do billing, unicidade de assinatura; falta exercício remoto. |
| Usuário A versus B | NÃO TESTADO | Não existem duas identidades autorizadas para exercício real de isolamento. |
| Pendente/suspensa/cancelada | NÃO TESTADO remotamente | Testes unitários do handler cobrem pendente sem RPC e repasse de suspensão/cancelamento; não substituem a validação de banco/produção. |
| Plano/preço alterado pelo cliente | APROVADO (privilégios) | `anon` e `authenticated` não possuem UPDATE em plans nem EXECUTE em billing_subscribe; preço vem de plans na RPC. Não exercitado com sessão válida. |
| RPC operacional privilegiada | APROVADO | admin_sync_license sem EXECUTE para anon/authenticated; slug_available com EXECUTE público e resposta REST 200/true para endereço disponível. |
| RLS | APROVADO (inventário) | Zero tabelas public sem RLS nos dois projetos. Não equivale a teste completo de todas as políticas. |
| Segredos no frontend | APROVADO (amostra) | Dez scripts públicos da página inicial inspecionados: zero chave sb_secret completa e zero JWT service_role. Não é auditoria de todos os logs. |
| Falha no billing | APROVADO unitariamente | Handler real testado com falha HTTP/rede/JSON/formato: 502 BILLING_UNAVAILABLE, nenhuma chamada de provisionamento. Indução remota não feita. |

## Causas e correções

1. **Divergência dashboard/GitHub:** license-sync remoto v1, hash do bundle
   `255c945c3dca94242d3883d13abeff25768a88d93135b99004b350ebe80b16a5`,
   possui um único index.ts com utilitários embutidos. A versão do repositório
   importa `_shared/http.ts`. A remota já captura falhas de consulta ao billing,
   valida o array de assinaturas, verifica configuração e protege parse/RPC.
   O repositório não tratava rede/JSON inválido do billing e tratava ausência de
   `subscriptions` como lista vazia de sucesso. Corrigido esse comportamento e
   criados testes do handler. A versão manual remota foi preservada; não foi
   substituída por uma versão menos defensiva. **Não houve deploy de Edge Functions.**
2. **Sucesso sem provisionamento:** contratação aceitava uma lista vazia de sync
   como sucesso; renovar/cancelar/atualizar ignoravam erros individuais; Portal
   descartava o resultado da sincronização. Corrigidos actions.ts, core/billing.ts
   e portal/page.tsx; agora há validação da resposta, confirmação do tenant_id
   correspondente e informação de falhas. Testes unitários cobrem regressões.
3. **Endereços inacessíveis na Vercel:** Production e Preview tinham
   `PDP_ROOT_DOMAIN=pontodopedido.vercel.app`, `PDP_PATH_TENANTS=0`. O caminho
   `/r/...` devolvia 404, e não há domínio curinga configurado para os subdomínios
   gerados. Alterado PDP_PATH_TENANTS para 1 em ambos os ambientes, preservando
   a arquitetura existente. Rótulos do Portal e contratação agora mostram o
   endereço por caminho quando esse modo está ativo. Alteração publicada na Vercel;
   `/r/audit-20261016` chega ao renderer e retorna 404 por restaurante inexistente,
   sem a antiga rejeição do proxy.
4. **Chaves fixas no CI:** o workflow repetia a mesma chave publicável estática
   para app e billing, apesar de cada stack local gerar sua própria chave.
   Removidas essas constantes e adicionada exportação para GITHUB_ENV apenas
   das chaves públicas locais de cada projeto, obtidas pelo status da CLI sem
   imprimir o JSON completo (que inclui credenciais administrativas).
5. **Expectativas de banco anteriores à migração de preços:** o CI conseguiu
   iniciar as stacks e executar 50 testes: 48 passaram e 2 falharam porque
   ainda esperavam planos sem preço. Atualizados os testes de catálogo para
   4999/8000/15000 e os eventos de pagamento para START a 49,99. O caso
   PRICE_UNDEFINED agora usa um plano isolado numa transação revertida, sem
   sobrescrever o preço de qualquer plano oficial. Execução inicial:
   [CI 38967479524](https://github.com/aruanmf446-hub/ponto_do_pedido/actions/runs/38967479524).

Billing v3 e team v2 foram obtidos pelo conector. Seus fontes e dependências
coincidem com o repositório, desconsiderando newline final. Todas as quatro
funções (incluindo webhook) estão ACTIVE e com verify_jwt=false. Os handlers de
usuário consultam `/auth/v1/user`; billing consulta o Auth do app. O frontend
valida getUser antes de encaminhar o access_token da sessão. Issuer do token e
eventuais overrides de secrets de identidade não puderam ser comprovados sem
sessão; não foram lidos valores de secrets. No license-sync remoto, a resposta
401 em vez de CONFIG_ERROR indica que o teste de configuração mínima passou.

## Validação e limitações da infraestrutura

- `npm run lint`, `npm run typecheck`: aprovados.
- `npm test`: 47 testes aprovados, 10 arquivos (17 testes novos).
- `npm run build`: aprovado; compilação e geração das rotas concluídas. Repetido
  depois das últimas alterações antes do push.
- Playwright contra a Vercel: 3 aprovados, Chromium real, sem mocks: formulário
  de cadastro/login, controle de acesso anônimo, três preços. Para repetir:
  `PDP_E2E_PUBLIC_SMOKE=1 PDP_E2E_BASE_URL=https://pontodopedido.vercel.app npm run test:e2e -- tests/e2e/production-smoke.spec.ts`.
  Em ambiente que exija proxy, definir PDP_E2E_PROXY com o proxy disponibilizado
  pelo ambiente. Nenhuma credencial de teste está incluída nesse teste.
- `npm run test:db`: **REPROVADO por infraestrutura**, 6 arquivos falharam,
  12 testes falharam e 38 foram pulados. Conexões locais 54322/55322 recusadas.
  Foi tentado `node scripts/local-supabase.mjs start`; Docker respondeu
  `failed to register layer: no space left on device` ao baixar
  supabase/postgres:17.11.0.004. Tentativa interrompida; nenhum teste de banco é
  declarado aprovado. Não foi executada limpeza destrutiva nem alterado o Docker.
- E2E autenticado local no CI: **APROVADO**, 28 testes passaram; os 3 testes
  públicos de produção opt-in ficaram pulados nessa suíte local. Seed local de
  cadastro, contratação, sincronização e equipe concluído.
  E2E autenticado remoto: **NÃO TESTADO**, identidade não fornecida. Nenhum seed
  foi executado contra produção.
- Vercel: deploy inicial READY em main no commit
  `8c5a8ebc70da23c20668d1804bdc3e7dda11bc4f`.
  Leitura de variáveis por project ID e sem teamId funcionou: Production e
  Preview apontam aos dois refs corretos, com chaves publicáveis correspondentes.
  Leitura de build logs retornou 404 com e sem teamId; runtime logs retornou
  403 forbidden. Não interpretar essas falhas como ausência de erros.
  CLI Vercel/credenciais não estão configuradas no executor para fallback.
- Advisors do app registram avisos de RPCs SECURITY DEFINER executáveis. Isso
  inclui APIs públicas e RPCs protegidas por authorize, previstas pela arquitetura;
  não foram revogadas indiscriminadamente. RLS em private.counters sem política
  é bloqueio por padrão. Referências:
  [RPCs públicas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
  [RPCs autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Encerramento — evidências do CI e do deploy

- Código validado: `00103a9768402a4b8018a88154c46d7c51466151`, na main.
- [CI 38968139693](https://github.com/aruanmf446-hub/ponto_do_pedido/actions/runs/38968139693):
  **APROVADO**, lint, tipos, 47 unitários, build, **50 testes de banco** e
  **28 E2E** (3 testes opt-in de produção pulados somente na suíte local).
  A falha de infraestrutura deste executor não impediu validar banco/E2E no runner.
- Vercel: **APROVADO**, deploy `dpl_EaXy9xDS61bPt1ALMX2NEXPLmQ2d` READY,
  associado a `pontodopedido.vercel.app`, commit `00103a9`. Os 3 testes públicos
  Playwright já passaram contra a aplicação publicada depois das correções de código.
- Supabase app: amostra de logs das últimas 24 horas, consultada apenas por
  agregação: 10 function_logs, 4 function_edge_logs e 3 auth_logs, nenhum padrão
  completo `sb_secret_` encontrado. Isso não comprova ausência de todo tipo de
  credencial nem substitui a leitura dos logs Vercel bloqueados.
- Check adicional **REPROVADO por configuração de infraestrutura**:
  Cloudflare Workers tenta `npm run cf:build`, script ausente. Causa confirmada
  pelos logs do build `29dbd3a2-b4b8-47e1-b69b-8b38ebb9f22d`. É um vínculo de
  deploy adicional ao destino oficial Vercel. Não foi adicionada arquitetura
  Cloudflare nem alterado esse vínculo; sua remoção/reconfiguração exige definir
  o destino pretendido para essa integração antiga.
- Billing, team e mercadopago-webhook remotos e suas dependências conferem com
  os fontes do repositório desconsiderando newline final. License-sync mantém
  as diferenças explícitas descritas acima.

Esta última atualização é documental e usa `[skip ci]` para evitar repetir as
stacks sem alteração de código; as provas acima referem-se ao commit de código
validado, cujos arquivos permanecem idênticos.

## Critério de conclusão

**Ainda não atendido:** falta comprovar com identidade autorizada o caminho
cadastro → confirmação → login → assinatura isolada → licença → Portal → apps,
incluindo isolamento A/B e revogação. A política immediate sem provedor continua
sendo risco comercial conhecido; não foi alterada nem usada para fabricar uma
prova de pagamento. Nenhuma cobrança real, mudança de Auth/RLS/preço, migração
remota ou exclusão de dados de cliente foi realizada.
