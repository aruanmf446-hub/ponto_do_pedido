import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/core/supabase/server';
import { SecurityForm } from '@/apps/plataforma/SecurityForms';
export const metadata = { title: 'Segurança da conta', robots: { index: false, follow: false } };
export default async function AccountSecurity({
  searchParams,
}: {
  searchParams: Promise<{ confirmacao?: string; erro?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?next=/portal/seguranca');
  const { confirmacao, erro } = await searchParams;
  return (
    <div className="pl-narrow">
      <p className="pl-eyebrow">Portal do Assinante</p>
      <h1>Segurança da conta</h1>
      <p>
        E-mail atual: <strong>{user.email}</strong>
      </p>
      {erro ? (
        <p role="alert" className="pl-error">
          O link de alteração está inválido ou expirou. Confira o e-mail atual e solicite a alteração novamente se necessário.
        </p>
      ) : null}
      {user.new_email ? (
        <p className="pl-note" role="status">
          Alteração pendente para {user.new_email}. Confira as confirmações nos dois endereços. Seu e-mail de acesso ainda é{' '}
          {user.email}.
        </p>
      ) : null}
      {confirmacao ? (
        <p role="status" className="pl-note">
          Confira o e-mail atual acima. A alteração pode exigir confirmação no endereço antigo e no novo; abrir apenas um dos
          links pode não concluir o processo.
        </p>
      ) : null}
      <h2>Alterar e-mail</h2>
      <p className="pl-muted">
        Confirme sua senha atual. Não encerre o acesso às caixas de entrada antes de concluir as confirmações.
      </p>
      <SecurityForm mode="email" />
      <p>
        <Link href="/portal">Voltar ao Portal</Link>
      </p>
    </div>
  );
}
