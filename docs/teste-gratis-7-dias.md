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

**Migrações**: `20261017195118_trial_schema_seven_days.sql` e `20261017195208_trial_functions_seven_days.sql`.

## Auditoria de QA (17/10/2026)

- Corrigidos o teste E2E de checkout obsoleto e a comparação de schema em teste de migração.
- Acrescentados testes de 7 dias, idempotência, proibição de segundo teste e expiração no banco local.
- Nomes das duas migrations alinhados aos números efetivamente registrados no Supabase remoto (não reaplicar em produção).
- A contratação e o webhook Mercado Pago seguem sem transação real de homologação; não afirmar que houve pagamento ou ativação reais.

- Auditoria de sincronização: contratos apenas pendentes e cancelados antes de qualquer vigência são ignorados sem serem reportados como erro. O teste ativo de outro restaurante continua sincronizando sem alerta indevido.
- Há uma contratação pendente com checkout Mercado Pago iniciado no projeto comercial. Não cancelar nem converter automaticamente sem reconciliar o contrato no provedor; essa pendência conserva o endereço reservado.

- O CI usa Webpack apenas para compilar nas máquinas GitHub Actions: o build de produção na Vercel mantém seu processo habitual.
- A fixture local de pagamento cria assinatura via RPC no banco PostgreSQL local, sem conta ou cobrança no Mercado Pago. A licença ainda é sincronizada via Edge Function e usuário real do Auth local.
- No billing, a resolução do Auth local é permitida somente para URLs internas Docker em HTTP e configuração de teste explícita; produção HTTPS usa exclusivamente o Auth cadastrado.
