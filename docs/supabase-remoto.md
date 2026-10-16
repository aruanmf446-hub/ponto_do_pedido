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

### App — `qmhtzosfbosgolevnybd`

Histórico remoto:
- `20261015105703_core`: conteúdo idêntico a `backend/app/supabase/migrations/20261015035134_core.sql`.
- `20261015110239_permissions_catalog`: parte do catálogo de permissões.
- `20261015110258_permissions_default_roles`: função de papéis padrão.

**Atenção:** os dois registros de permissões não representam todo o arquivo
`20261015035352_permissions_admin.sql`. Não se comprovou equivalência literal
com o arquivo completo. Não executar `migration repair` nem reaplicar o arquivo
inteiro às cegas: inspecionar objetos existentes e preparar apenas o restante necessário.

Sequência de **arquivos pendentes**, respeitando as dependências:
1. Restante de `20261015035352_permissions_admin.sql` — reconciliar com os dois registros parciais.
2. `20261015035354_catalog.sql`
3. `20261015035356_operation.sql`
4. `20261015035358_public_channels.sql`
5. `20261015035400_finance.sql`
6. `20261015035402_stock.sql`
7. `20261015035404_reports_onboarding.sql`
8. `20261015035406_approvals_grants.sql`
9. `20261015035408_storage_realtime.sql`
10. `20261015043604_approval_kinds_catalog.sql`
11. `20261015154053_public_templates.sql`
12. `20261016090000_slug_available.sql`

`public_templates` depende da definição de `tenant_update_settings` em
`permissions_admin`, por isso não se aplica primeiro apesar de ter sido inicialmente solicitada assim.
`slug_available` é requerida no fluxo `billing.subscribe`.

Funções remotas do app: **nenhuma**. Pendentes `license-sync` e `team`,
ambas projetadas com `verify_jwt=false` e validação própria via
`/auth/v1/user`. Não implantá-las antes das RPCs de que dependem
(`admin_sync_license`, `admin_attach_member`, `admin_find_user_by_email`).

### Billing — `bjtlookhgkdltdohzxnq`

- `20261015105542_billing`: conteúdo byte a byte igual a
  `backend/billing/supabase/migrations/20261015040000_billing.sql`.
- Oito tabelas com RLS ativo. `plans` é a única com leitura direta pelos papéis de clientes.
- Edge Function `billing` implantada, versão 1, `verify_jwt=false`; código idêntico ao GitHub no momento da auditoria.
- Não há migração do billing pendente naquele inventário.

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
