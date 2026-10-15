import Link from 'next/link';
import { planPriceLabel, type Plan } from '@/core/billing';
import { FLOW, MODULES, PRINCIPLES } from '@/apps/plataforma/content';

export function Landing({ plans }: { plans: Plan[] }) {
  return (
    <>
      <section className="pl-section pl-hero" aria-labelledby="hero-title">
        <p className="pl-eyebrow">Plataforma para restaurantes</p>
        <h1 id="hero-title">Cada área do restaurante no seu próprio aplicativo.</h1>
        <p>
          Atendimento, Cozinha, Caixa, Cardápio Digital, Delivery, Financeiro e Estoque trabalham juntos, com as mesmas mesas,
          produtos e preços — e cada pessoa entra direto na sua área.
        </p>
        <div className="pl-cta">
          <Link href="/planos" className="pl-btn">
            Conhecer os planos
          </Link>
          <Link href="/entrar" className="pl-btn pl-btn--ghost">
            Já sou assinante
          </Link>
        </div>
        <div className="pl-hero-board" aria-hidden="true">
          <span>
            <strong>Atendimento</strong>Mesa 12 · pedido enviado
          </span>
          <span>
            <strong>Cozinha</strong>Pedido #1046 em preparo
          </span>
          <span>
            <strong>Caixa</strong>Comanda quitada
          </span>
          <span>
            <strong>Gestão</strong>Mesa liberada
          </span>
        </div>
      </section>

      <section className="pl-section" id="aplicativos" aria-labelledby="apps-title">
        <p className="pl-eyebrow">Aplicativos</p>
        <h2 id="apps-title" className="pl-h2">
          Produtos independentes, operação integrada.
        </h2>
        <div className="pl-grid">
          {MODULES.map((m, i) => (
            <article key={m.id}>
              <span className="pl-index">{String(i + 1).padStart(2, '0')}</span>
              <h3>{m.name}</h3>
              <p>{m.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pl-section" aria-labelledby="principles-title">
        <p className="pl-eyebrow">Como pensamos</p>
        <h2 id="principles-title" className="pl-h2">
          Simples para quem opera. Seguro para quem é dono.
        </h2>
        <div className="pl-principles">
          {PRINCIPLES.map((p) => (
            <div key={p.title}>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pl-section" aria-labelledby="flow-title">
        <p className="pl-eyebrow">Começo rápido</p>
        <h2 id="flow-title" className="pl-h2">
          Do contrato à primeira mesa atendida.
        </h2>
        <ol className="pl-flow">
          {FLOW.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      {plans.length > 0 ? (
        <section className="pl-section" aria-labelledby="plans-title">
          <p className="pl-eyebrow">Planos</p>
          <h2 id="plans-title" className="pl-h2">
            Escolha os aplicativos da sua operação.
          </h2>
          <PlanCards plans={plans} />
        </section>
      ) : null}
    </>
  );
}

export function PlanCards({ plans }: { plans: Plan[] }) {
  return (
    <>
      <div className="pl-plans">
        {plans.map((plan, i) => (
          <article key={plan.code} className="pl-plan" data-featured={i === plans.length - 1}>
            <h3>{plan.name}</h3>
            <p className="pl-plan-tag">{plan.tagline}</p>
            <p className="pl-price">{planPriceLabel(plan)}</p>
            <ul>
              {plan.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <Link href={`/contratar?plano=${plan.code}`} className={`pl-btn ${i === plans.length - 1 ? '' : 'pl-btn--ghost'}`}>
              Assinar {plan.name}
            </Link>
          </article>
        ))}
      </div>
      <p className="pl-note">
        Valores e condições comerciais são definidos pela equipe comercial do Ponto do Pedido. Nenhuma cobrança é realizada
        automaticamente nesta plataforma enquanto o meio de pagamento não estiver configurado.
      </p>
    </>
  );
}
