# Billing central CRM PLUS — 16/10/2026

Complemento dos relatórios de integração anteriores, que permanecem preservados.
O Supabase `bjtlookhgkdltdohzxnq` pertence à plataforma comercial CRM PLUS;
`qmhtzosfbosgolevnybd` é exclusivamente o operacional/Auth do Ponto do Pedido.
Não foram criados projetos, migrados usuários ou alterados preços e provedores.

## Causas e implementação

O billing validava todas as sessões em um único projeto Auth, não distinguia o
produto nas contas/planos/assinaturas e usava `MP_BACK_URL` com fallback fixo do
Ponto do Pedido. Isso não atendia ao ecossistema multiproduto.

A migração **preparada, não aplicada remotamente**
`20261016222507_central_products.sql` adiciona:

- Registro `products`, disponível somente ao serviço administrativo: ID estável,
  nome, projeto Auth autorizado, chave publicável, retorno escolhido e lista de
  retornos permitidos, verificação opcional de slug e versão dos termos.
- `product_id` em planos, contas, assinaturas, contratos, faturas, eventos e
  idempotência. As chaves compostas impedem associações entre produtos.
- Identidade única por `(product_id, identity_user_id)`. Nenhum usuário é copiado
  para o billing Auth; contas comerciais guardam a referência da origem validada.
- Planos e slugs podem repetir entre produtos; módulos não estão limitados aos
  nomes dos aplicativos do Ponto do Pedido.
- Gateway `billing_product_call`, somente service_role, com ações explícitas e
  contexto limitado à transação. As RPCs antigas ficam restritas ao produto legado
  quando não há contexto, mantendo compatibilidade.
- Catálogo público por produto; configuração Auth permanece privada.
- O webhook único resolve o produto pela assinatura/preapproval já registrado.
  Valor e período são consultados no plano daquele produto; eventos e faturas
  recebem o mesmo produto. A idempotência global do provedor continua preservada.

A Edge Function `billing` resolve o cadastro pelo `product_id`, valida a sessão
em `/auth/v1/user` daquele projeto autorizado e transmite somente a identidade
validada ao gateway. O navegador não escolhe Auth URL, preço, retorno ou função
SQL. Retornos exigem HTTPS, correspondência exata na lista do produto e ausência
de credenciais/fragmento. Não existe mais `MP_BACK_URL` global nem nome fixo de
produto na descrição enviada ao Mercado Pago.

O cliente do Ponto do Pedido fixa `product_id=ponto_do_pedido`, inclusive após o
payload, e filtra o catálogo. `license-sync` solicita esse produto e recusa uma
resposta/assinatura identificada como pertencente a outro produto. As proteções
da versão manual foram incorporadas à versão modular: configuração obrigatória,
parse seguro das chaves e erro de rede/JSON na RPC operacional tratado sem secrets.

## Compatibilidade e implantação

As duas migrações pendentes devem ser analisadas/aplicadas em ordem:

1. `20261016213840_require_confirmed_payment.sql` — exige pagamento confirmado.
2. `20261016222507_central_products.sql` — separação dos produtos.

A primeira continua aguardando autorização específica para alterar a política
financeira remota, conforme o escopo anterior. A segunda também permanece
preparada, pois depende dessa política. Não aplicar uma isoladamente nem ativar
provedor como atalho. O código novo mantém o remoto legado funcionando somente
para Ponto do Pedido: fallback apenas quando a RPC de cadastro realmente não
existe (`PGRST202`), nunca em falhas de rede/JSON, produto desconhecido ou inativo.
O catálogo sem filtro só é aceito se a coluna de produto ainda não existe
(`42703`); erros comuns não removem o filtro. Após implantação completa, remover
compatibilidade em uma migração coordenada.

Consulta remota nesta etapa: zero contas comerciais, assinaturas e faturas;
`payment_provider=null`, `activation_mode=immediate`, cadastro multiproduto ausente.
A contratação pública continua bloqueada pela comprovação de política de pagamento.
Nenhuma assinatura artificialmente ativa ou cobrança foi criada na produção.

Para cadastrar um produto futuro, o administrador registra seu Auth real,
chave publicável e retornos exatos em `products`, depois seus planos por
`(product_id,code)`. O produto usa seu próprio Auth e envia seu ID ao billing.
Seu sincronizador valida e aplica somente suas licenças no próprio banco.
Novos produtos enviam `resource_name`/`resource_slug`; os nomes legados
`restaurant_name`/`restaurant_slug` continuam aceitos para compatibilidade.
O overview inclui os nomes genéricos, sem exigir um restaurante nos outros SaaS.
Não são necessárias novas funções de pagamento ou outro webhook. Oficina/Vendas
não foram cadastrados com refs inventados. O cadastro é uma operação de serviço;
não existe escrita de configuração pelo navegador.

## Auth: pendência separada e exclusiva do aplicativo

O fallback do e-mail ainda precisa ser corrigido no projeto
`qmhtzosfbosgolevnybd`, em
[Auth URL Configuration](https://supabase.com/dashboard/project/qmhtzosfbosgolevnybd/auth/url-configuration):

- Site URL: `https://pontodopedido.vercel.app`
- Redirect URL permitida: `https://pontodopedido.vercel.app/**`

Não configurar esse domínio como Site URL global do billing central. Não alterar
confirmação de e-mail, usuários ou RLS. O conector atual não disponibiliza edição
de Auth config, não há navegador administrativo conectado e a CLI não tem token
de gerenciamento. A autorização do titular já existe; falta capacidade de acesso.
O login da identidade real confirmada foi aprovado anteriormente; isso não prova
que o retorno do próximo e-mail esteja corrigido.

## Validação

- Unitários: testes do handler real para Auth por produto, token cruzado, produto
  inexistente, falha do cadastro, retorno malicioso e descrição/retorno do produto.
- Cliente: filtro do catálogo, fallback estritamente legado e payload incapaz de
  sobrescrever produto/ação definidos no servidor.
- PostgreSQL local: migrações aplicadas em banco isolado; 15 testes comerciais
  passaram, incluindo seis cenários multiproduto. Fixtures revertidas.
- Integração remota de segundo produto: NÃO TESTADO; não há outro Auth/identidade
  autorizado nem migração implantada. Testes unitários não substituem essa prova.
- CI, deploy e regressão remota: evidências registradas abaixo.

## Publicação e regressão em produção

Commits de código na main:

- `56bfbce` — separa billing central por produto e valida Auth de origem.
- `c9b939e` — restringe catálogo e sincronização ao produto contratado.

Funções remotas comparadas arquivo por arquivo com os fontes versionados:

| Função / projeto | Versão | Resultado |
| --- | --- | --- |
| billing / assinaturas | 5 | APROVADO: arquivos idênticos; verify_jwt=false com validação interna |
| license-sync / pontodopedido | 2 | APROVADO: arquivos idênticos; proteções manuais preservadas |

Hashes dos bundles: billing
`9747da23c3fc8bba61e35834afc954089cacc7456cb1d6c265e561da4e4ea49c`;
license-sync `223e36990e733e396ba447a5b5144160a7ed3370e9af8e48b258bb102cc65334`.

Deploy de código Vercel `dpl_FVFma6vaDdTEbnSN92dQj3z7Raw8`: READY, main
`c9b939e007b1185dc30a952a1fa2e522950403ee`, alias oficial
https://pontodopedido.vercel.app/. Production e Preview conferidos novamente:
Auth/operacional aponta para qmhtzosfbosgolevnybd, billing para
bjtlookhgkdltdohzxnq, root domain oficial e PATH_TENANTS=1.

Playwright real com identidade autorizada: login, reload, issuer operacional,
Portal, billing com product_id explícito, duas sincronizações vazias, negação de
token ausente/inválido, negação de produto desconhecido, logout e refresh revogado
passaram em 390 e 1440 px. A contratação autenticada retornou 503
PAYMENT_CONFIRMATION_REQUIRED nos dois tamanhos. SQL confirmou ao final zero
contas comerciais, contratos, assinaturas, faturas e restaurantes; uma única
identidade autorizada confirmada. Preços seguem 4999/8000/15000 centavos e
payment_provider=null. Isso prova a proteção, não uma licença paga funcionando.

`npm run lint`, `npm run typecheck`, `npm test` (87 testes) e `npm run build`
passaram localmente. As seis migrações finais foram aplicadas em PostgreSQL local
isolado e os 15 testes comerciais passaram. A execução integral de `npm run
test:db` neste ambiente teve 15 aprovados, cinco falhas de conexão do operacional
a 54322 e 38 não executados; o Supabase operacional completo não está disponível
localmente. A CI executa as duas stacks reais para concluir essa validação.
`npm run test:e2e -- tests/e2e/production-smoke.spec.ts` passou os sete testes
públicos/negativos de produção, incluindo catálogo e larguras 390/1440.

Uma busca no bundle do navegador não encontrou MP_ACCESS_TOKEN ou
SUPABASE_SERVICE_ROLE_KEY; a única ocorrência do prefixo sb_secret_ era a
comparação de prefixos da biblioteca Supabase, sem valor de chave incorporado.
Nenhum JWT, senha ou secret foi registrado nas evidências versionadas.

| Fluxo | Resultado | Evidência |
| --- | --- | --- |
| Cadastro real | REPROVADO | Conta confirmada, mas fallback de verificação ainda 303 para localhost:3000 |
| Login e sessão | APROVADO | Chromium 390/1440, recarga, issuer correto, logout e refresh recusado |
| Billing | APROVADO para consulta e bloqueio seguro; contratação NÃO TESTADA | 200 overview vazio; 503 na contratação até aprovação da migração |
| License-sync | APROVADO para sessão/negação e ausência de licença | v2, 200 results vazio repetido, inválido/ausente 401 |
| Criação de restaurante | NÃO TESTADO | Não existe licença paga autorizada; zero restaurantes |
| Acesso aos aplicativos | NÃO TESTADO | Não foi fabricada licença ativa em produção |
| Isolamento A/B remoto | NÃO TESTADO | Falta segunda identidade autorizada; isolamento por produto passou em banco local |
| Proteção contra acesso sem pagamento | APROVADO | Bloqueio real 503 sem criar dados; migração pendente testada no banco local |
| Cloudflare | REPROVADO, evidência anterior preservada | Trigger antigo chama cf:build inexistente; recurso não removido sem comprovar desuso |
| CI | APROVADO | Run 38976338801, código c9b939e; 87 unitários, 58 de banco e 28 E2E |
| Vercel produção | APROVADO | Deploy READY da main e sete testes públicos após publicação |

A etapa multiproduto está implementada e preparada para implantação de banco,
mas NÃO está homologada com um segundo SaaS remoto. Pendências reais: acesso à
configuração Auth do app, autorização da política financeira/migrações e uma
segunda identidade autorizada para isolamento remoto. Não há cobrança habilitada.


CI concluída com sucesso: [run 38976338801](https://github.com/aruanmf446-hub/ponto_do_pedido/actions/runs/38976338801),
commit `c9b939e007b1185dc30a952a1fa2e522950403ee`. Lint, TypeScript, build,
87 testes unitários, 58 testes de banco e 28 E2E aprovados. Os sete testes opt-in
de produção foram executados separadamente e aprovados no domínio oficial.
A ausência do Supabase operacional nesta máquina foi coberta pela execução
integral da CI, sem ignorar as falhas locais de infraestrutura.
