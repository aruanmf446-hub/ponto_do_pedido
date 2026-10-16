import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SubscribeForm } from '@/apps/plataforma/SubscribeForm';
import { checkoutAvailable, fetchPlans } from '@/core/billing';
import { getCurrentUser } from '@/core/supabase/server';

export const metadata: Metadata = { title: 'Contratar' };

export default async function ContractPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const { plano } = await searchParams;
  if (!(await getCurrentUser())) redirect(`/cadastro${plano ? `?plano=${encodeURIComponent(plano)}` : ''}`);
  const [plans, available] = await Promise.all([fetchPlans(), checkoutAvailable()]);
  const initial = plans.find((p) => p.code === plano)?.code ?? plans[0]?.code ?? '';
  return (
    <div className="pl-narrow">
      <p className="pl-eyebrow">Contratação</p>
      <h1 style={{ fontSize: '2.2rem' }}>Contrate seu plano</h1>
      <p className="pl-muted">
        Escolha o plano e o endereço da sua equipe. O acesso será liberado após a confirmação do pagamento.
      </p>
      {plans.length === 0 ? (
        <p className="pl-error">Planos indisponíveis no momento.</p>
      ) : (
        <SubscribeForm plans={plans} initialPlan={initial} checkoutAvailable={available} />
      )}
    </div>
  );
}
