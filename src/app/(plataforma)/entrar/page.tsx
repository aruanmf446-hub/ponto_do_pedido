import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SigninForm } from '@/apps/plataforma/AuthForms';
import { getCurrentUser } from '@/core/supabase/server';

export const metadata: Metadata = { title: 'Entrar' };

export default async function SigninPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/portal';
  if (await getCurrentUser()) redirect(target);
  return (
    <div className="pl-narrow">
      <p className="pl-eyebrow">Portal do Assinante</p>
      <h1 style={{ fontSize: '2.2rem' }}>Entrar</h1>
      <p className="pl-muted">Colaboradores entram pelo endereço do restaurante (ex.: seurestaurante.pontodopedido.com).</p>
      <SigninForm next={target} />
    </div>
  );
}
