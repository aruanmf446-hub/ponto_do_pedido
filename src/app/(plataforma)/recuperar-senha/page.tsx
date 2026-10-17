import { SecurityForm } from '@/apps/plataforma/SecurityForms';
export const metadata = { title: 'Recuperar senha' };
export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <div className="pl-narrow">
      <h1>Recuperar senha</h1>
      {erro ? (
        <p className="pl-error" role="alert">
          O link está inválido ou expirou. Solicite uma nova recuperação e abra o e-mail no mesmo navegador.
        </p>
      ) : null}
      <p className="pl-muted">Informe seu e-mail. Por segurança, não informamos se existe uma conta cadastrada.</p>
      <SecurityForm mode="request" />
    </div>
  );
}
