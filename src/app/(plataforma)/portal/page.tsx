import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOutPlatform } from '@/apps/plataforma/actions';
import { SubscriptionCard } from '@/apps/plataforma/Portal';
import { billingCall, fetchPlans, syncLicenses, type BillingOverview } from '@/core/billing';
import { rpcRead } from '@/core/rpc';
import { getCurrentUser } from '@/core/supabase/server';
import { tenantDisplayUrl, tenantUrl } from '@/core/tenant/urls';

export const metadata: Metadata = { title: 'Portal do Assinante' };

type MyTenant = {
  id: string;
  slug: string;
  name: string;
  is_owner: boolean;
  onboarding_completed_at: string | null;
  subscription_id: string | null;
};

export default async function PortalPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?next=/portal');

  const overview = await billingCall<BillingOverview>('overview');
  const subscriptions = overview.ok ? overview.data.subscriptions : [];
  // Mantém licenças do projeto operacional alinhadas com a origem comercial
  const sync = subscriptions.length > 0 ? await syncLicenses() : null;
  const syncError = sync && (!sync.ok ? sync.message : sync.data.results.find((result) => result.error)?.error);
  const [plans, tenants] = await Promise.all([fetchPlans(), rpcRead<MyTenant[]>('my_tenants', {})]);
  const isHolder = subscriptions.length > 0;

  if (!isHolder) {
    // Não titular: acesso restrito ao portal, apenas atalhos para os restaurantes
    return (
      <div className="pl-narrow">
        <p className="pl-eyebrow">Portal do Assinante</p>
        <h1 style={{ fontSize: '2rem' }}>Acesso restrito</h1>
        <p className="pl-muted">
          O Portal do Assinante é exclusivo do titular da assinatura. Para operar, entre pelo endereço do seu restaurante.
        </p>
        {!overview.ok ? <p className="pl-error">{overview.message}</p> : null}
        <ul className="pl-steps" style={{ marginTop: 24 }}>
          {tenants.map((t) => (
            <li key={t.id}>
              <span className="pl-step-dot" aria-hidden="true">
                →
              </span>
              <div>
                <strong>{t.name}</strong>
                <small>{tenantDisplayUrl(t.slug)}</small>
              </div>
              <a className="pl-btn pl-btn--small" href={tenantUrl(t.slug)}>
                Entrar
              </a>
            </li>
          ))}
        </ul>
        <div className="pl-row" style={{ marginTop: 24 }}>
          <Link href="/planos" className="pl-btn pl-btn--ghost">
            Contratar para meu restaurante
          </Link>
          <Link href="/portal/seguranca" className="pl-btn pl-btn--ghost">
            Segurança da conta
          </Link>
          <form action={signOutPlatform}>
            <button type="submit" className="pl-btn pl-btn--ghost">
              Sair
            </button>
          </form>
        </div>
      </div>
    );
  }

  const onboardingBySlug = new Map(tenants.map((t) => [t.slug, !!t.onboarding_completed_at]));
  return (
    <div className="pl-wide">
      <div className="pl-portal-head">
        <div>
          <p className="pl-eyebrow">Portal do Assinante</p>
          <h1>{overview.ok ? (overview.data.account?.name ?? 'Titular') : 'Titular'}</h1>
          <p className="pl-muted" style={{ margin: 0 }}>
            Assinaturas, plano, renovação e acesso aos seus restaurantes.
          </p>
        </div>
        <div className="pl-row">
          <Link href="/contratar" className="pl-btn pl-btn--ghost">
            Novo restaurante
          </Link>
          <Link href="/portal/seguranca" className="pl-btn pl-btn--ghost">
            Segurança da conta
          </Link>
          <form action={signOutPlatform}>
            <button type="submit" className="pl-btn pl-btn--ghost">
              Sair
            </button>
          </form>
        </div>
      </div>
      {overview.ok && overview.data.payment_provider == null ? (
        <p className="pl-note" style={{ marginTop: 0 }}>
          Cobrança: o meio de pagamento da plataforma ainda não está configurado. As faturas ficam registradas em aberto e nenhuma
          cobrança automática é realizada.
        </p>
      ) : null}
      {syncError ? (
        <p className="pl-error" role="alert">
          {syncError}
        </p>
      ) : null}
      <div style={{ display: 'grid', gap: 16 }}>
        {subscriptions.map((sub) => (
          <SubscriptionCard
            key={sub.id}
            sub={sub}
            plans={plans}
            onboardingDone={onboardingBySlug.get(sub.restaurant_slug) ?? false}
            paymentProvider={overview.ok ? overview.data.payment_provider : null}
          />
        ))}
      </div>
      <section className="pl-card" style={{ marginTop: 24 }} aria-labelledby="acessos">
        <h2 id="acessos" style={{ fontSize: '1.2rem' }}>
          Acessos da equipe
        </h2>
        <p className="pl-muted" style={{ margin: 0 }}>
          Cada colaborador entra pelo endereço do restaurante com o próprio e-mail. Após o login, o sistema valida as permissões e
          direciona para a área autorizada. Cadastre colaboradores e permissões na Gestão.
        </p>
      </section>
    </div>
  );
}
