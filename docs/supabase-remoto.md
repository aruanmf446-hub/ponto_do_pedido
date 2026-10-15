# Estado dos projetos Supabase remotos

Atualizado em 15/10/2026.

## assinaturas (`bjtlookhgkdltdohzxnq`) — concluído
- Migration `billing` aplicada (8 tabelas, RLS, 9 funções). Corpo das funções conferido
  byte a byte com o ambiente local (md5 por função).
- Edge Function `billing` publicada (v1, `verify_jwt=false`: valida o token no Auth do pontodopedido).
- Conferido: `anon`/`authenticated` só leem `plans`; nenhuma função executável pelo navegador.
- Advisors: apenas avisos informativos (tabelas sem política = acesso negado por padrão; índices
  ainda não usados).

## pontodopedido (`qmhtzosfbosgolevnybd`) — parcial
Aplicado:

| Versão remota | Nome | Equivale a |
| --- | --- | --- |
| 20261015105703 | core | `20261015035134_core.sql` (completo) |
| 20261015110239 | permissions_catalog | início de `20261015035352_permissions_admin.sql` (catálogo de permissões) |
| 20261015110258 | permissions_default_roles | `private.seed_default_roles` do mesmo arquivo |

Pendente: o restante de `20261015035352_permissions_admin.sql` e as migrations
`20261015035354_catalog` até `20261015043604_approval_kinds_catalog`; Edge Functions
`license-sync` e `team`.

**Motivo:** a ferramenta de migração exige confirmação humana para SQL com instruções
destrutivas (há `delete from` dentro de funções, p. ex. sincronização de módulos e edição de
funções). Sem a confirmação, a aplicação expira e é revertida. Não foi feita nenhuma
alteração para contornar essa confirmação.

## Como concluir

Opção A — nesta conversa/sessão do Claude, com o titular presente para confirmar cada aplicação.

Opção B — Supabase CLI (a partir de `backend/app`), com token de acesso e senha do banco:

```bash
npx supabase link --project-ref qmhtzosfbosgolevnybd
# alinha o histórico remoto com os arquivos locais (os comandos abaixo só alteram o histórico)
npx supabase migration repair --status reverted 20261015105703 20261015110239 20261015110258
npx supabase migration repair --status applied 20261015035134
npx supabase db push            # aplica 035352 (idempotente sobre o que já existe) em diante
npx supabase functions deploy license-sync --no-verify-jwt
npx supabase functions deploy team --no-verify-jwt
```

Depois: rodar os advisors de segurança e desempenho e configurar Auth → URL Configuration
(Site URL e Redirect URLs, ver `docs/supabase.md`).
