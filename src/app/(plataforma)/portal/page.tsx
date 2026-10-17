import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOutPlatform } from '@/apps/plataforma/actions';
import { SubscriptionCard } from '@/apps/plataforma/Portal';
import { billingCall, syncLicenses, type BillingOverview } from '@/core/billing';
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

  // Primeiro acesso não pode esperar Mercado Pago, catálogo nem sincronização
  // de uma licença que ainda não existe.
  const [overview, initialTenants] = await Promise.all([
    billingCall<BillingOverview>('overview'),
    rpcRead<MyTenant[]>('my_tenants', {}),
  ]);
  const subscriptions = overview.ok ? overview.data.subscriptions : [];
  const mustSync = subscriptions.some((sub) => sub.status !== 'pending_payment');
  const sync = mustSync ? await syncLicenses() : null;
  const syncError = sync && (!sync.ok ? sync.message : sync.data.results.find((result) => result.error)?.error);
  const tenants = sync?.ok ? await rpcRead<MyTenant[]>('my_tenants', {}) : initialTenants;
  const isHolder = subscriptions.length > 0;

  if (!overview.ok) {
    return (
      <section className="pl-account-state" aria-labelledby="portal-error-heading">
        <div className="pl-account-state-main">
          <p className="pl-eyebrow">Portal do Assinante · Conectado</p>
          <h1 id="portal-error-heading">Não conseguimos consultar suas assinaturas<span>.</span></h1>
          <p className="pl-account-state-lead">
            Sua sessão está ativa, mas o serviço de assinaturas não respondeu corretamente.
            Nenhum dado foi alterado.
          </p>
          <p className="pl-error" role="alert">{overview.message}</p>
          <div className="pl-account-state-actions">
            <a href="/portal" className="pl-btn">Tentar novamente <span aria-hidden="true">↗</span></a>
            <Link href="/portal/seguranca" className="pl-btn pl-btn--ghost">Segurança da conta</Link>
          </div>
        </div>
        <div className="pl-account-state-side">
          <span className="pl-account-state-index">PORTAL / 01</span>
          <p>Não é necessário criar outra conta para tentar novamente.</p>
        </div>
      </section>
    );
  }

  if (!isHolder && tenants.length === 0) {
    return (
      <section className="pl-account-state" aria-labelledby="primeiro-acesso-heading">
        <div className="pl-account-state-main">
          <p className="pl-eyebrow">Portal do Assinante · Primeiro acesso</p>
          <span className="pl-account-state-status"><span aria-hidden="true" /> Conta conectada</span>
          <h1 id="primeiro-acesso-heading">Sua conta está pronta.<br />Falta o restaurante<span>.</span></h1>
          <p className="pl-account-state-lead">
            Você já tem acesso ao Ponto do Pedido. Para começar, escolha o plano e cadastre o seu restaurante.
            Não é preciso criar outro usuário.
          </p>
          <div className="pl-account-state-actions">
            <Link href="/contratar" className="pl-btn">Cadastrar meu restaurante <span aria-hidden="true">↗</span></Link>
            <Link href="/portal/seguranca" className="pl-btn pl-btn--ghost">Segurança da conta</Link>
          </div>
        </div>
        <div className="pl-account-state-side">
          <span className="pl-account-state-index">COMECE POR AQUI / 01—03</span>
          <ol className="pl-account-state-steps">
            <li><span>01</span><div><strong>Escolha o plano</strong><small>START, PLUS ou DIAMOND, conforme a operação.</small></div></li>
            <li><span>02</span><div><strong>Cadastre o restaurante</strong><small>Nome e endereço exclusivo da sua equipe.</small></div></li>
            <li><span>03</span><div><strong>Experimente e configure</strong><small>7 dias grátis, sem cartão. Depois escolha como assinar.</small></div></li>
          </ol>
          <div className="pl-account-state-signature" aria-hidden="true">
            <span className="pl-account-state-mark">P<span>•</span></span>
            <span>Seu próximo pedido começa aqui.</span>
          </div>
        </div>
      </section>
    );
  }

  if (!isHolder) {
    return (
      <section className="pl-account-state" aria-labelledby="acesso-equipe-heading">
        <div className="pl-account-state-main">
          <p className="pl-eyebrow">Ponto do Pedido · Acesso da equipe</p>
          <h1 id="acesso-equipe-heading">Seu restaurante está a um clique<span>.</span></h1>
          <p className="pl-account-state-lead">
            Você tem acesso operacional aos estabelecimentos abaixo. Assinaturas e pagamentos são
            administrados exclusivamente pelo titular.
          </p>
          <div className="pl-account-state-actions">
            <Link href="/portal/seguranca" className="pl-btn pl-btn--ghost">Segurança da conta</Link>
            <form action={signOutPlatform}>
              <button type="submit" className="pl-btn pl-btn--ghost">Sair da conta</button>
            </form>
          </div>
        </div>
        <div className="pl-account-state-side">
          <p className="pl-eyebrow">Seus acessos</p>
          <ul className="pl-account-restaurants">
            {tenants.map((t) => (
              <li key={t.id}>
                <div><strong>{t.name}</strong><small>{tenantDisplayUrl(t.slug)}</small></div>
                <a href={tenantUrl(t.slug)} className="pl-btn pl-btn--small">Abrir <span aria-hidden="true">↗</span></a>
              </li>
            ))}
          </ul>
        </div>
      </section>
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
