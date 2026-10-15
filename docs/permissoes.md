# Autenticação, permissões e aprovações

## Autenticação
- Identidade única no Auth do **pontodopedido**. Sessão em cookie (`@supabase/ssr`), renovada no proxy.
- Colaboradores recebem senha temporária e trocam no primeiro acesso (`/senha`).
- Após o login: área principal autorizada (`primary_app` ou o primeiro aplicativo permitido).

## Hierarquia
Titular (dono) → Gestor → Supervisores → colaboradores. Funções padrão: Gestor, Supervisor,
Atendente, Caixa, Cozinha, Administrativo e Estoquista (editáveis em Gestão → Funções e permissões).
Concessões individuais podem ter **limite em centavos**, **prazo** e **poder de delegar**.

## Validação universal (`private.authorize`)
1. identifica usuário e estabelecimento (sessão, vínculo ativo, estabelecimento ativo);
2. verifica o módulo contratado;
3. verifica a permissão (função, concessão direta, revogação);
4. verifica limites (valor);
5. executa — **ou** responde `APPROVAL_REQUIRED` com a permissão em `HINT`;
6. o app oferece "solicitar aprovação" (`approval_request_create`);
7. a solicitação vai a quem pode decidir (tem a permissão direta e o limite);
8. o aprovador aprova ou recusa (`approval_decide`);
9. na execução, tudo é **revalidado** (aprovador e solicitante ainda ativos e autorizados);
10. o registro vai para `audit_log` com o id da aprovação.

Regras: aprovação vale uma vez; revogação tem efeito imediato; ninguém decide a própria
solicitação (compras e reembolsos inclusive); delegação só do que se pode delegar.

## Erros de negócio
O banco lança `P0001` com o código em `DETAIL` (`FORBIDDEN`, `APPROVAL_REQUIRED`, `TENANT_INACTIVE`,
`MODULE_DISABLED`, `PROCESS_EXTERNAL`, `SELF_APPROVAL`, `LOT_EXPIRED`, …). `src/core/errors.ts`
converte em `ActionResult` e o hook `useAction` abre o diálogo de aprovação quando cabível.
