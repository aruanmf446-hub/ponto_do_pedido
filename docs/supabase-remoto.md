# Supabase remoto — auditoria e saneamento

Atualizado em 15/10/2026. Fonte: leitura direta pelo plugin Supabase + arquivos da branch `main`.
**Este documento não autoriza alterações automáticas em produção.** É preciso aprovação específica por migração, deploy, mudança de Auth e operação destrutiva.

## Projetos oficiais

| Projeto | Ref | Papel |
| --- | --- | --- |
| pontodopedido | `qmhtzosfbosgolevnybd` | Identidade/Auth, restaurantes, operação |
| assinaturas | `bjtlookhgkdltdohzxnq` | Planos, contas, assinaturas, contratos, faturas |

Não criar terceiro projeto. Chaves `sb_secret_` e `service_role` nunca pertencem ao GitHub ou a logs.

## Estado confirmado

### App — `qmhtzosfbosgolevnybd` (atualizado em 16/10/2026)

**Todas as 11 migrações autorizadas foram aplicadas no remoto, em ordem, sem falhas:**

| Versão registrada no Supabase | Arquivo de origem |
| --- | --- |
| `20261016034558_permissions_admin_20261015035352` | `20261015035352_permissions_admin.sql` |
| `20261016034608_20261015035354_catalog` | `20261015035354_catalog.sql` |
| `20261016034611_20261015035356_operation` | `20261015035356_operation.sql` |
| `20261016034614_20261015035358_public_channels` | `20261015035358_public_channels.sql` |
| `20261016034626_20261015035400_finance` | `20261015035400_finance.sql` |
| `20261016034628_20261015035402_stock` | `20261015035402_stock.sql` |
| `20261016034631_20261015035404_reports_onboarding` | `20261015035404_reports_onboarding.sql` |
| `20261016034633_20261015035406_approvals_grants` | `20261015035406_approvals_grants.sql` |
| `20261016034644_20261015035408_storage_realtime` | `20261015035408_storage_realtime.sql` |
| `20261016034646_20261015043604_approval_kinds_catalog` | `20261015043604_approval_kinds_catalog.sql` |
| `20261016034648_20261015154053_public_templates` | `20261015154053_public_templates.sql` |

Três migrações anteriores (`core`, `permissions_catalog`,
`permissions_default_roles`) permaneceram intactas. A migração
`20261016090000_slug_available.sql` foi propositalmente **pulada**, porque
`slug_available(text)` já foi criada em `permissions_admin`.

Consulta solicitada pelo titular (`pg_get_functiondef`, MD5) executada em leitura,
com o resultado **completo** de 141 definições (38 private, 103 public):
[auditoria-funcoes-app-20261016.md](./auditoria-funcoes-app-20261016.md).

Edge Functions verificadas:
- `team`: **ACTIVE**, versão 1, `verify_jwt=false`.
- `license-sync`: **NÃO IMPLANTADA**. A tentativa pelo plugin foi bloqueada
  pela camada de segurança da plataforma; não contornar a restrição.
  A função `admin_sync_license` já existe no banco, mas não substitui a Edge Function.

Após a execução: 0 usuários e 0 restaurantes. O fluxo de licença de ponta a ponta
continua pendente até a implantação autorizada de `license-sync` e teste real.

### Billing — `bjtlookhgkdltdohzxnq`

- `20261015105542_billing`: conteúdo byte a byte igual a
  `backend/billing/supabase/migrations/20261015040000_billing.sql`.
- Oito tabelas com RLS ativo. `plans` é a única com leitura direta pelos papéis de clientes.
- Edge Function `billing` implantada, versão 1, `verify_jwt=false`; código idêntico ao GitHub no momento da auditoria.
- Não há migração do billing pendente naquele inventário.

### Preços e confirmação de pagamento — 16/10/2026

- `20261016120000_payment_requires_confirmation.sql` aplicado como
  `20261016032611_payment_requires_confirmation_20261016120000`.
  `billing_subscribe` exige estado pendente sempre que `payment_provider` não for nulo.
- `20261016130000_precos_planos.sql` aplicado como
  `20261016032640_precos_planos_20261016130000`.
  START R$ 49,99/mês (`4999` centavos), PLUS R$ 80,00/mês (`8000`),
  DIAMOND R$ 150,00/mês (`15000`). Valores conferidos no banco.
- `payment_provider` permaneceu `null` e `activation_mode` permaneceu
  `immediate`: **ainda não habilitar contratação pública paga ou emitir cobranças**.
- **Bloqueio do fluxo:** no app `qmhtzosfbosgolevnybd`, não há Edge Functions,
  `admin_sync_license` nem `slug_available`. Contratação real e liberação da
  licença exigem primeiro as migrações operacionais e o deploy de `license-sync`.
- Secrets do Mercado Pago foram cadastrados pelo titular, mas o valor/ambiente
  (teste versus produção) não foi comprovado pelo plugin.
- Um teste sintético de assinatura inválida no webhook **não valida pagamento**.
  É necessário um evento oficial do provedor e comprovar idempotência, atualização
  da fatura e somente então habilitar o provedor.

### Mercado Pago — implantação posterior (16/10/2026)

- Migração local `backend/billing/supabase/migrations/20261016100000_mercadopago.sql`
  aplicada no remoto com histórico `20261016031437_mercadopago_20261016100000`.
  **A versão remota usa timestamp gerado pelo plugin, não o prefixo do arquivo**:
  comparar conteúdo antes de qualquer tentativa de reaplicar.
- Verificado: `public.payment_events` existe com RLS ativo; 5 campos de provider
  existem em `subscriptions`; 4 RPCs financeiras possuem execução para
  `service_role` e não para `anon`/`authenticated`.
- Edge Function `mercadopago-webhook`: implantada, versão 1, ativa,
  `verify_jwt=false`, autenticidade das notificações validada no código.
- Edge Function `billing`: ativa, versão 3, `verify_jwt=false`.
- **Cobrança NÃO ativada**: `payment_provider = null`; `activation_mode = "immediate"`.
  Os planos START, PLUS e DIAMOND seguem com `price_cents = null`.
- Ainda não verificado: notificação real do Mercado Pago, validade do conteúdo
  dos três secrets e fluxo completo de pagamento. Webhook cadastrado na conta do
  Mercado Pago também precisa ser validado fora do Supabase.

**Decisão comercial pendente:** `platform_settings.activation_mode = "immediate"`
e `payment_provider = null`. Assim, criar e renovar uma assinatura não comprova
pagamento: o fluxo pode conceder ou prolongar acesso sem cobrança real.
Definir política de ativação, pagamento e renovação antes de comercializar.

## Segurança

- Todas as 14 tabelas `public` do app e as 8 do billing têm RLS.
- Nenhuma view `public` encontrada.
- Aviso de segurança: `public.check_permission` e `public.rls_auto_enable`
  são `SECURITY DEFINER` com execução para `anon` e `authenticated`;
  revisar concessões com testes de permissão antes de revogar.
- App: 6 FKs sem índices de cobertura. App/billing: índices ainda sem uso;
  não removê-los só com base no aviso.
- Billing: 7 tabelas RLS sem política intencionalmente inacessíveis ao público.

## Auth e diagnóstico

- O plugin não fornece leitura da configuração remota `site_url`,
  `uri_allow_list`, `mailer_autoconfirm`, tempo de sessão e JWT.
- Configuração proposta, ainda **não aplicada**:
  `https://pontodopedido.com` e redirects
  `https://pontodopedido.com/**`, `https://*.pontodopedido.com/**`.
- Confirmação de e-mail/SMTP e regras de sessão dependem de decisão do titular.
- Sem usuários ou sessões remotos durante a auditoria; o erro local
  `AUTH_REQUIRED` não pôde ser reproduzido no remoto.
- Os scripts locais passaram a ler as chaves publicáveis de cada stack
  separadamente e o Auth das funções do app passou a registrar apenas o
  código HTTP das rejeições — nunca o token ou as chaves.
- O runtime local `billing` com código 255 não foi reproduzido/diagnosticado remotamente.

## Procedimento obrigatório antes de cada alteração

1. Solicitar aprovação **por item**; nenhuma autorização genérica substitui essa etapa.
2. Inspecionar objetos existentes, impacto, dependências e dados antes da execução.
3. Aplicar uma alteração por vez e conferir resultado no PostgreSQL/Edge Functions.
4. Validar RLS, privilegios, advisors, tipos e casos negativos.
5. Registrar histórico, hashes/corpos remotos e consultas de validação aqui.
6. Só após permissão separada realizar smoke test com usuário de teste e limpeza controlada.

Verificações após as respectivas migrações (somente leitura):

```sql
select to_regprocedure('public.admin_sync_license(uuid,uuid,text,text,public.tenant_status,text,timestamptz,public.app_module[])');
select to_regprocedure('public.public_templates(text)');
select to_regprocedure('public.slug_available(text)');
select to_regprocedure('public.tenant_update_settings(uuid,jsonb)');
```

As assinaturas `to_regprocedure` devem ser conferidas contra a definição realmente criada
(se a assinatura divergir, usar `pg_proc` por nome e tipos). Não invocar RPC
comercial de escrita como suposta prova de migração.
