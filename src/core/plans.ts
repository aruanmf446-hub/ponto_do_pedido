// Tipos e formatação do catálogo comercial (seguros para o navegador).
// Valores vêm do projeto `assinaturas`; nada aqui define preços.

export type Plan = {
  code: string;
  name: string;
  tagline: string;
  description: string;
  modules: string[];
  price_cents: number | null;
  billing_period: 'monthly' | 'yearly';
  highlights: string[];
  position: number;
};

export type Invoice = {
  id: string;
  amount_cents: number | null;
  period_start: string;
  period_end: string;
  due_date: string;
  status: 'open' | 'paid' | 'void';
};

export type Subscription = {
  id: string;
  plan_code: string;
  plan_name: string;
  modules: string[];
  price_cents: number | null;
  billing_period: 'monthly' | 'yearly';
  status: 'pending_payment' | 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
  restaurant_name: string;
  restaurant_slug: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  provider_status?: string | null;
  next_payment_at?: string | null;
  payment_url?: string | null;
  invoices: Invoice[];
};

export type BillingOverview = {
  account: { id: string; email: string; name: string } | null;
  payment_provider: string | null;
  subscriptions: Subscription[];
};

export function planPriceLabel(plan: Pick<Plan, 'price_cents' | 'billing_period'>): string {
  if (plan.price_cents == null) return 'Valor sob consulta';
  const value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.price_cents / 100);
  return `${value}/${plan.billing_period === 'yearly' ? 'ano' : 'mês'}`;
}
