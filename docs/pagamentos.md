# Pagamentos (Mercado Pago)

> Arquitetura central multiproduto e implantação pendente: [billing CRM PLUS](./billing-multiproduto-20261016.md).
> O Auth de cada SaaS é independente; o domínio do Ponto do Pedido não é destino global.

> Inventário remoto atualizado e limitações dos testes:
> [auditoria de 16/10/2026](./integracao-20261016.md). As referências de estado
> abaixo descrevem momentos anteriores e não devem substituir a consulta remota.

A cobrança das assinaturas é **exclusiva do projeto Supabase `assinaturas`** (`backend/billing`).
O banco do restaurante (`pontodopedido`) não guarda dados do Mercado Pago; ele só recebe o
resultado como licença, pelo `license-sync`, que lê a assinatura já ativa no billing.

```
Portal ── start_payment ──► Edge Function billing ──► Mercado Pago (cria assinatura, devolve o checkout)
Cliente paga no checkout do Mercado Pago
Mercado Pago ── webhook ──► Edge Function mercadopago-webhook
        valida x-signature → consulta o recurso na API → billing_apply_mercadopago (idempotente)
        → assinatura ativa, fatura paga, período estendido
Portal / login ── license-sync ──► app libera o restaurante conforme a licença
```

## Projetos corretos e pré-requisitos

- **Auth e licenças (app):** `qmhtzosfbosgolevnybd` — `https://qmhtzosfbosgolevnybd.supabase.co`.
- **Mercado Pago e assinaturas (billing):** `bjtlookhgkdltdohzxnq` — `https://bjtlookhgkdltdohzxnq.supabase.co`.
- A função `billing` valida a sessão no Auth do **app**, jamais no Auth do billing.
  Seu fallback de `PDP_IDENTITY_URL` precisa apontar para o ref correto.
- **Estado remoto conferido em 16/10/2026:** a migração `20261016100000_mercadopago`
  não havia sido aplicada, `mercadopago-webhook` não estava implantada,
  `payment_provider` era nulo, `activation_mode` era `immediate` e os planos
  START/PLUS/DIAMOND estavam sem preços. Configurar segredos não instala funções
  nem aplica migrations.
- A aprovação de pagamento precisa corresponder à assinatura registrada, ter
  moeda **BRL** e valor igual ao preço cadastrado do plano. Eventos incompatíveis
  devem ser auditados e ignorados, sem liberar licença.

## O que o sistema faz
- Cria uma assinatura recorrente (mensal ou anual, conforme o plano) em estado pendente; o cliente autoriza no checkout.
- A assinatura só vira **ativa** quando uma cobrança é **aprovada**. Autorização sozinha não ativa.
- Cobrança recusada: `past_due`. Nova aprovação: volta a `active` e estende o período.
- Cancelamento no Mercado Pago agenda o fim do período vigente.
- Notificações repetidas não duplicam faturas (`payment_events` e índice único em `invoices`).
- Com o provedor ligado, `Renovar` e `Alterar plano` manuais ficam bloqueados (não estendem período sem pagamento).

## O que o sistema NÃO faz
- Não define preços. Plano com `price_cents` nulo não inicia cobrança ("O valor do plano ainda não foi definido.").
- Não cobra nada enquanto `payment_provider` for nulo (estado padrão).
- Não troca o plano de uma assinatura com cobrança online (a regra de proporcional é decisão comercial pendente).

## Configuração (feita pelo titular; nunca cole credenciais em chat ou no código)
1. **Mercado Pago**: crie uma aplicação em Suas integrações. Use primeiro as credenciais de **teste**.
2. **Webhook** (Suas integrações → Webhooks, modo teste e depois produção):
   - URL: `https://bjtlookhgkdltdohzxnq.supabase.co/functions/v1/mercadopago-webhook`
   - Tópicos: `subscription_preapproval` e `subscription_authorized_payment`.
   - Copie a **chave secreta** do webhook.
3. **Secrets do projeto assinaturas** (no seu computador, com a CLI logada):
   ```
   supabase secrets set --project-ref bjtlookhgkdltdohzxnq \
     MP_ACCESS_TOKEN=<access token de teste> \
     MP_WEBHOOK_SECRET=<chave secreta do webhook>
   ```
   O retorno é definido por produto em `products`, não por `MP_BACK_URL` global.
4. **Migração** `20261016100000_mercadopago` aplicada no projeto assinaturas.
5. **Funções**: `supabase functions deploy billing mercadopago-webhook --project-ref bjtlookhgkdltdohzxnq`.
6. **Preços**: defina `plans.price_cents` (decisão comercial do titular).
7. **Ligar** (decisão do titular):
   ```sql
   update public.platform_settings set value = '"mercadopago"' where key = 'payment_provider';
   ```
8. **Teste** com usuários de teste do Mercado Pago. Só depois troque para as credenciais de produção.

Com `payment_provider` ligado, a contratação sempre nasce pendente e só ativa com pagamento confirmado (migração `20261016120000`),
mesmo que `activation_mode` continue `immediate`.
Para desligar: volte `payment_provider` para `'null'::jsonb`.

## Verificação feita
- Banco: fluxo completo (contratar, iniciar, aprovar, recusar, cancelar), idempotência, bloqueio de renovação manual e permissões (`tests/db/payments.test.ts`).
- Unidade: assinatura do webhook, montagem da assinatura e seleção de recursos (`tests/unit/mercadopago.test.ts`).
- **Não verificado**: chamadas reais à API do Mercado Pago e execução das Edge Functions. Confirme em modo de teste antes de produção,
  em especial o formato do `x-signature` e os campos de `authorized_payments`.
