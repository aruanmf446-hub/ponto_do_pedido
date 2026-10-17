# Teste gratuito de sete dias — Ponto do Pedido

- Avaliação sem cartão, sem invoice e sem acesso ao checkout do Mercado Pago.
- Disponível apenas para o produto `ponto_do_pedido`, uma vez por conta comercial, com validação de identidade no Auth do aplicativo.
- Plano escolhido no cadastro: START, PLUS ou DIAMOND; módulos herdados do catálogo do produto.
- Prazo calculado e persistido no projeto comercial (`trial_started_at`, `trial_ends_at`) por relógio do PostgreSQL.
- Entitlement `trialing` validado novamente pelo `license-sync`; no banco operacional, `tenant_operational` bloqueia assim que `license_valid_until <= now()`.
- O `billing_settle_expired` muda `trialing` vencido para `suspended` durante consultas comerciais. Não depende de crons ou de relógio do navegador.
- Conversão voluntária via checkout Mercado Pago. Apenas confirmação oficial de pagamento ativa assinatura paga.
- Assinaturas pendentes ou pagas existentes não são alteradas pela migração.
- A verificação do checkout ocorre após renderização do formulário; falhas do Mercado Pago não impedem o teste grátis.
- Para homologar: conta de teste nova, escolher plano, iniciar teste, validar licença e Gestão, consultar vencimento e bloqueio após expiração e simular pagamento em sandbox antes de habilitar cobrança real.

**Migrações**: `20261017170000_trial_schema.sql` e `20261017170100_trial_functions.sql`.
