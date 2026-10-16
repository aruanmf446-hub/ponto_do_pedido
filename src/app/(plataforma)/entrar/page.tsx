import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SigninForm } from '@/apps/plataforma/AuthForms';
import { getCurrentUser } from '@/core/supabase/server';
import { safeAuthNext } from '@/core/auth/redirect';

export const metadata: Metadata = { title: 'Entrar' };

export default async function SigninPage({ searchParams }: { searchParams: Promise<{ next?: string; confirmacao?: string }> }) {
  const { next, confirmacao } = await searchParams;
  const target = safeAuthNext(next, '/portal');
  if (await getCurrentUser()) redirect(target);
  return (
    <div className="pl-narrow">
      <p className="pl-eyebrow">Portal do Assinante</p>
      <h1 style={{ fontSize: '2.2rem' }}>Entrar</h1>
      {confirmacao === 'continuar' ? (
        <p role="status" className="pl-note">
          Se você já confirmou seu e-mail, entre para continuar. O link pode ter sido aberto em outro navegador ou ter expirado.
        </p>
      ) : null}
      <p className="pl-muted">Colaboradores entram pelo endereço do restaurante (ex.: seurestaurante.pontodopedido.com).</p>
      <SigninForm next={target} />
    </div>
  );
}
