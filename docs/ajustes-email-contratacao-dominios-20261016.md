# E-mail, contratação e endereços — 16/10/2026

Complemento dos relatórios anteriores, sem substituir suas evidências.

## Código corrigido

- Template profissional em português e assunto versionados no projeto Auth do
  aplicativo. A variável oficial ConfirmationURL preserva a confirmação e o callback.
  [Publicação manual e homologação](./email-confirmacao.md). Não foi publicado no Dashboard.
- Contratação consulta prontidão autenticada, sem criar cobrança. Só apresenta
  continuação para pagamento se as duas migrações estiverem disponíveis, a política
  exigir confirmação, o provedor central estiver habilitado, houver credencial de
  pagamento e retorno autorizado do produto. Qualquer falha mantém bloqueado.
- Sai “Contratar e ativar”/“Ativando”; entra “Contratação indisponível” com botão
  desabilitado enquanto bloqueado. Quando liberado: “Continuar para pagamento”.
  Não há promessa de acesso antes do pagamento. Portal mostra “Aguardando pagamento”
  e não oferece renovação/alteração de plano que a API atualmente recusa.
- O fluxo já preparado registra assinatura pendente, segue ao checkout quando
  autorizado e só libera licença após o webhook único confirmar pagamento válido.
  Falha ao iniciar checkout mantém pendência no Portal, sem licença ativa.
- Preferência por hostname é independente da aceitação do fallback `/r/`.
  `PDP_TENANT_SUBDOMAINS_READY` nasce desligado e nunca inventa wildcard vercel.app.
  `PDP_PATH_TENANTS=1` permanece necessário e ativo na produção atual.
- Teste autenticado em produção encontrou overflow horizontal de 13 px em 390 px.
  O tamanho intrínseco do seletor de planos alargava as colunas do formulário.
  Corrigidas as larguras mínimas dos campos e a quebra de endereços longos, sem redesenho.
- Disponibilidade do identificador no cadastro não é anunciada como comprovação
  de DNS ou propriedade. Uma resposta para slug anterior não aparece como
  disponibilidade do novo identificador.

## Revisão das migrações pendentes

**Nenhuma migração foi aplicada remotamente. Nenhum provedor, preço ou cobrança foi alterado.**
As versões preparadas ainda podem ser revisadas porque não constam do histórico remoto.
Aplicação futura exige autorização e deve seguir a ordem dos arquivos:

1. `20261016213840_require_confirmed_payment.sql`: novas assinaturas sempre
   pending_payment, sem período ativo; idempotência transacional; renovação e
   alteração exigem pagamento. Helpers exclusivos de service_role. Não modifica
   dados financeiros existentes nem reclassifica licenças legadas.
2. `20261016222507_central_products.sql`: backfill explicitamente para o produto
   legado, depois defaults por contexto para novas operações. Preserva a versão
   dos termos já configurada. Restrições compostas separam contas, planos, contratos,
   faturas e eventos por produto. A validação de módulos do Ponto do Pedido foi
   preservada sem limitar os módulos de outros SaaS.

Problema encontrado na segunda migração: REVOKE/GRANT em todas as funções public
poderia afetar funções não relacionadas de outros produtos. Substituído por uma
lista explícita das funções criadas/alteradas. Cadastro Auth e gateway permanecem
privados; catálogo ativo por produto é público, com os grants específicos.
O teste de migração cria dados legados antes das duas alterações e compara os
mesmos IDs, preços, estados, faturas, contas e contratos depois. Também comprova
que permissões de uma função não relacionada não são alteradas e que anon/authenticated
não executam gateway, configuração, política ou contratação privilegiada.

Preflight remoto somente leitura: zero contas, assinaturas, contratos, faturas e
eventos; zero referências de plano órfãs e zero assinaturas legadas active/past_due.
Termos 2026-10; activation_mode=immediate, payment_provider=null; helpers de política
multiproduto ainda ausentes. Preços START 4999, PLUS 8000, DIAMOND 15000 centavos.
Anon/authenticated sem EXECUTE em billing_subscribe e sem UPDATE nos planos;
service_role possui EXECUTE. Isso explica PAYMENT_CONFIRMATION_REQUIRED.

Antes de uma aplicação futura, repetir o preflight e revisar backup, dependências
externas, tempo de locks das alterações de constraints e eventual presença de
planos históricos em contratos/faturas. Se houver dados legados ativos sem fatura
paga, interromper a liberação comercial para decisão explícita: as migrações
preservam o estado desses registros, não fabricam confirmação de pagamento.
Não habilitar payment_provider, MP_ACCESS_TOKEN ou cobranças como parte da migração.
O billing continua multiproduto CRM PLUS, com um único webhook e retorno por produto.

## Domínio e configuração manual

Objetivo: **famiglia-da-pizza.pontodopedido.com**. Não é endereço operacional anunciado.
Leitura Vercel: somente pontodopedido.vercel.app vinculado ao projeto oficial;
nenhum pontodopedido.com ou wildcard. DNS público via Google: NS/A do domínio,
A do restaurante e CNAME do wildcard retornaram NXDOMAIN. Consulta à conexão
Cloudflare disponível: nenhuma zona pontodopedido.com encontrada. Isso não prova
quem possui o domínio e não autoriza compra, registro, transferência ou delegação.
TLS do wildcard não pôde ser homologado sem DNS/domínio operacional.

Configuração futura, a cargo do titular com propriedade comprovada:

1. Confirmar titularidade/controle de pontodopedido.com. Não há ação de compra nesta entrega.
2. Associar domínio e wildcard ao mesmo projeto Vercel. Usar os registros e a
   verificação que a Vercel gerar naquele momento; não inventar IP/CNAME ou delegar
   nameservers sem analisar DNS/MX/TXT já existentes. Certificado wildcard pode
   exigir DNS/delegação conforme a configuração da Vercel.
3. Comprovar DNS, verificação e HTTPS tanto no domínio principal quanto em um
   hostname de restaurante autorizado. Testar rewrite, cookies, login, acesso
   permitido e recusa de restaurante inexistente, sem fabricar licença.
4. Só então definir PDP_ROOT_DOMAIN=pontodopedido.com e
   PDP_TENANT_SUBDOMAINS_READY=1 no ambiente pertinente e fazer novo deploy.
   Manter PDP_PATH_TENANTS=1 durante a transição; só desativar por decisão explícita
   após validar todos os links. Conferir cookies e callbacks Auth do produto.
5. Se o domínio principal de produção mudar, atualizar Site URL, allowlist do
   aplicativo e retorno autorizado desse produto no billing; não aplicar domínio
   de um SaaS como retorno global dos demais.

Até isso acontecer, os links reais continuam no domínio oficial Vercel com `/r/`.
O resolvedor por hostname já existente foi preservado; não foi adicionado outro deploy.

## Validação e publicação

- `npm run lint`, `npm run typecheck`, `npm test`: aprovados; 92 unitários.
- `npm run build`: aprovado localmente e na Vercel.
- Banco local comercial: 16 aprovados, incluindo migração sobre dados legados.
  A execução integral de `npm run test:db` neste executor teve 16 aprovados,
  cinco falhas de conexão com o operacional não iniciado e 38 não executados.
  A suíte completa foi validada na CI com as duas stacks, sem ignorar essa limitação.
- [CI 38981342086](https://github.com/aruanmf446-hub/ponto_do_pedido/actions/runs/38981342086):
  APROVADO no commit `a227baa19a8be2f49f23a4f62555aa0784f329a2`, 92 unitários,
  59 testes de banco e 32 E2E. Inclui contratação bloqueada e template em 390/1440.
  O primeiro job de build falhou no resolvedor Turbopack/next-font Big Shoulders
  (`next/font/google queries have exactly one entry`). O build da Vercel, o local
  e o do outro job passaram. Reexecutado somente o job falho, que passou sem
  alterações de fontes/código. Classificação: falha transitória do ambiente de build.
- `npm run test:e2e -- tests/e2e/production-smoke.spec.ts`: sete aprovados no
  Chromium contra a produção após o deploy, incluindo três preços e login negativo.
- Template HTML renderizado em Chromium local: dois testes aprovados, 390/1440.
  Isso não comprova envio ou publicação no Dashboard.
- Teste autenticado real, com a única identidade previamente autorizada, em
  390/1440: login, recarga, issuer correto do Auth, consulta comercial, duas
  sincronizações vazias, token ausente/inválido recusado, produto desconhecido
  recusado, logout e refresh revogado. Prontidão retornou available=false;
  contratação retornou 503 PAYMENT_CONFIRMATION_REQUIRED. Botão desabilitado,
  texto sem promessa de ativação e endereço de exemplo
  pontodopedido.vercel.app/r/famiglia-da-pizza conferidos. Sem overflow após o fix,
  sem injetar CSS no teste final. O primeiro teste encontrou a falha real de largura
  documentada acima; um timeout posterior era do roteiro, que procurava Sair na
  contratação em vez do Portal. Corrigido o roteiro e os dois tamanhos passaram.
- SQL final remoto confirmou zero contas comerciais, assinaturas, contratos e
  faturas; provider nulo, migrações ainda ausentes. Nenhuma assinatura ou licença
  de produção foi fabricada. Pagamento/licença ativa remotos: NÃO TESTADO.

Billing remoto v6 ACTIVE, verify_jwt=false com validação interna de sessão,
comparado arquivo por arquivo com os fontes enviados: iguais. Bundle:
`6f55afdf84e70ff88b0d9e6da1be8b256a8ba7831a27fb244c2f9b006a64ec3e`.
A única mudança de função nesta entrega consulta prontidão; não inicia pagamentos.
Webhook único e license-sync preservados. Nenhum token ou secret publicado.

Deploy de código Vercel `dpl_BmqsjoZNLP4GzHvDQ7TzjJ813VRr`, READY, commit
`a227baa19a8be2f49f23a4f62555aa0784f329a2`, alias oficial
https://pontodopedido.vercel.app/. A atualização documental final não altera o
código validado e usa [skip ci]; seu deploy será conferido no encerramento.

Commits de código na main:

- `fc411d7` — template em português, configuração local e instruções manuais.
- `57fd47c` — prontidão, interface comercial e revisão das migrações.
- `02fe991` — preferência por subdomínio somente após infraestrutura comprovada.
- `a227baa` — largura do formulário em celular.

| Item | Código e testes | Configuração manual restante |
| --- | --- | --- |
| E-mail | APROVADO: template e callback oficial preservado | Publicar assunto/HTML no Auth do app; corrigir Site URL/allowlist; manter confirmação obrigatória e homologar entrega |
| Contratação | APROVADO: bloqueio sem promessa de ativação e migrações revisadas/testadas | Aplicação remota das duas migrações somente com autorização; provedor/cobrança não habilitados |
| Endereços | APROVADO: hostname preservado e fallback real por /r/ | Comprovar propriedade, configurar domínio/wildcard/DNS/TLS na Vercel e só então habilitar preferência por subdomínios |

A entrega não declara o domínio próprio operacional, o template publicado no
Dashboard ou uma assinatura paga funcionando em produção. Essas dependências
estão separadas das correções já publicadas no código.
