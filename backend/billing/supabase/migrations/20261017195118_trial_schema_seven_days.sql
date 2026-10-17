-- Teste gratuito do produto Ponto do Pedido (7 dias, sem faturamento automático).
-- Migração separada: PostgreSQL exige confirmar o novo valor do enum antes de usá-lo.
alter type public.subscription_status add value if not exists 'trialing';

alter table public.subscriptions
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

-- Uma avaliação por conta comercial neste produto, inclusive depois de expirar.
create unique index if not exists subscriptions_one_trial_per_account_idx
  on public.subscriptions (account_id)
  where trial_started_at is not null and product_id = 'ponto_do_pedido';
