import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignupForm } from '@/apps/plataforma/AuthForms';
import { getCurrentUser } from '@/core/supabase/server';

export const metadata: Metadata = { title: 'Criar conta' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const { plano } = await searchParams;
  const next = `/contratar${plano ? `?plano=${encodeURIComponent(plano)}` : ''}`;
  if (await getCurrentUser()) redirect(next);
  return (
    <div className="pl-narrow">
      <p className="pl-eyebrow">Assinatura</p>
      <h1 style={{ fontSize: '2.2rem' }}>Crie sua conta de titular</h1>
      <p className="pl-muted">O titular controla a assinatura e a estrutura de autoridade do restaurante.</p>
      <SignupForm next={next} />
    </div>
  );
}
