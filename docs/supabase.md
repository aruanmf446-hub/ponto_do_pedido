# Supabase

## Projetos

| Projeto | Ref | Pasta | Papel |
| --- | --- | --- | --- |
| pontodopedido | `qmhtzosfbosgolevnybd` | `backend/app/supabase` | Operação, permissões, Auth (identidade), Storage, Realtime |
| assinaturas | `bjtlookhgkdltdohzxnq` | `backend/billing/supabase` | Planos, contas, assinaturas, contratos, faturas |

Variáveis (somente nomes; valores no provedor): `PDP_APP_SUPABASE_URL`,
`PDP_APP_SUPABASE_PUBLISHABLE_KEY`, `PDP_BILLING_SUPABASE_URL`, `PDP_BILLING_SUPABASE_PUBLISHABLE_KEY`.
As Edge Functions leem as chaves do próprio projeto (`SUPABASE_SECRET_KEYS`/`SUPABASE_PUBLISHABLE_KEYS`).

## Migrations (pontodopedido)

| Arquivo | Conteúdo |
| --- | --- |
| `…035134_core` | estabelecimentos, módulos, perfis, vínculos, permissões, funções, concessões, aprovações, auditoria, preferências visuais, responsabilidade por processo (ERP), onboarding; `private.authorize` |
| `…035352_permissions_admin` | catálogo de ~80 permissões, funções padrão, funções administrativas (service_role), contexto (`my_context`), equipe e configurações |
| `…035354_catalog` | setores, mesas (token de QR), categorias, produtos, formas de pagamento, zonas de entrega, horários, materiais |
| `…035356_operation` | comandas, pedidos, itens, delivery, caixa, pagamentos, movimentações; travas por comanda e idempotência |
| `…035358_public_channels` | cardápio por QR, pedido do cliente (chave do dispositivo), delivery e rastreio por token |
| `…035400_finance` | fornecedores, documentos, compras, cotações, pedidos, recebimentos, contas a pagar/receber, orçamentos, reembolsos, lançamentos |
| `…035402_stock` | locais, lotes, movimentações, inventário, solicitações de materiais, recebimento integrado |
| `…035404_reports_onboarding` | indicadores da Gestão e estado do onboarding |
| `…035406_approvals_grants` | despachante de aprovações, decisão/execução/cancelamento, concessões finais |
| `…035408_storage_realtime` | buckets e políticas de Storage, publicação Realtime |
| `…043604_approval_kinds_catalog` | tipos adicionais de aprovação para cadastros |

Tabelas (49): tenants, tenant_modules, profiles, memberships, permissions, roles, role_permissions,
membership_roles, member_permissions, approval_requests, audit_log, ui_preferences, process_ownership,
onboarding_steps, sectors, dining_tables, categories, products, payment_methods, delivery_zones,
business_hours, materials, tabs, orders, order_items, delivery_orders, cash_sessions, payments,
cash_movements, suppliers, documents, purchase_requests, purchase_request_items, quotations,
purchase_orders, purchase_order_items, goods_receipts, payables, receivables, budgets, reimbursements,
financial_entries, stock_locations, stock_lots, stock_movements, inventory_counts, inventory_count_lines,
material_requests, material_request_items.

## Migration (assinaturas)

`…040000_billing`: plans (START, PLUS, DIAMOND com módulos; `price_cents` nulo = "Valor sob
consulta"), platform_settings (sem provedor de pagamento), accounts, subscriptions,
subscription_events, contracts, invoices, idempotency. Somente `plans` é legível publicamente;
o restante é acessado pela Edge Function `billing`.

## RLS — princípios

- RLS ativo em todas as tabelas de `public`. `authenticated` tem apenas `SELECT`; escritas
  somente por RPC (exceto `ui_preferences`, restrita ao próprio usuário).
- Isolamento por estabelecimento: `private.is_member(tenant_id)`.
- Financeiro: `private.can_view_finance` (titular ou `financeiro.acessar`); quem pede compra ou
  reembolso vê os próprios registros.
- `anon` executa apenas as funções públicas (cardápio, pedido por QR, delivery, rastreio,
  disponibilidade de slug, informações públicas do restaurante).
- Storage: arquivos em `{tenant_id}/...`; documentos privados só para quem gere documentos/contas.

## Edge Functions

| Função | Projeto | `verify_jwt` | Papel |
| --- | --- | --- | --- |
| `license-sync` | pontodopedido | false (valida o token internamente) | sincroniza licenças a partir de `billing` |
| `team` | pontodopedido | false (valida o token internamente) | cria/vincula colaborador com senha temporária |
| `billing` | assinaturas | false (valida o token no Auth do pontodopedido) | visão geral, contratar, renovar, trocar plano, cancelar |

## Configuração externa necessária (painel Supabase)

- Auth → URL Configuration: Site URL `https://pontodopedido.com`; Redirect URLs
  `https://pontodopedido.com/**` e `https://*.pontodopedido.com/**`.
- Auth → confirmação de e-mail e SMTP próprio conforme a política do titular.
