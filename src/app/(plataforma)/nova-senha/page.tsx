import Link from 'next/link';
import { SecurityForm } from '@/apps/plataforma/SecurityForms';
import { recoveryUser } from '@/core/auth/recovery';
export const metadata = { title: 'Nova senha', robots: { index: false, follow: false } };
export default async function NewPasswordPage() {
  const user = await recoveryUser();
  return (
    <div className="pl-narrow">
      <h1>Nova senha</h1>
      {user ? (
        <SecurityForm mode="password" />
      ) : (
        <>
          <p role="alert" className="pl-error">
            Sua sessão de recuperação está inválida ou expirou.
          </p>
          <Link href="/recuperar-senha">Solicitar novo link de recuperação</Link>
        </>
      )}
    </div>
  );
}
