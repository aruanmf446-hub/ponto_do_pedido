import Link from 'next/link';
import type { VisualModel } from '@/core/apps';
import { planPriceLabel, type Plan } from '@/core/billing';
import { FoodArt } from '@/core/ui/FoodArt';
import { Icon } from '@/core/ui/Icon';
import { ModelThumb } from '@/core/ui/ModelThumb';
import { FLOW, MODULES, PRINCIPLES } from '@/apps/plataforma/content';
import { MODULE_ICON, SHOWCASE } from '@/apps/plataforma/siteTemplates';

/** Pratos de cozinhas diferentes: a plataforma serve a qualquer tipo de restaurante. */
const DISHES = ['Prato executivo', 'Hambúrguer artesanal', 'Sushi variado', 'Salada da estação', 'Massa fresca', 'Café especial', 'Açaí na tigela', 'Sobremesa da casa'];

function Cta() {
  return (
    <div className="pl-cta">
      <Link href="/planos" className="pl-btn">
        Conhecer os planos
      </Link>
      <Link href="/entrar" className="pl-btn pl-btn--ghost">
        Já sou assinante
      </Link>
    </div>
  );
}

function Modules({ numbered = false }: { numbered?: boolean }) {
  return (
    <div className="pl-grid">
      {MODULES.map((m, i) => (
        <article key={m.id} data-module={m.id}>
          {numbered ? (
            <span className="pl-index">{String(i + 1).padStart(2, '0')}</span>
          ) : (
            <span className="pl-module-icon">
              <Icon name={MODULE_ICON[m.id] ?? 'grid'} size={22} />
            </span>
          )}
          <h3>{m.name}</h3>
          <p>{m.text}</p>
        </article>
      ))}
    </div>
  );
}

function Principles() {
  return (
    <div className="pl-principles">
      {PRINCIPLES.map((p) => (
        <div key={p.title}>
          <h3>{p.title}</h3>
          <p>{p.text}</p>
        </div>
      ))}
    </div>
  );
}

function Flow() {
  return (
    <ol className="pl-flow">
      {FLOW.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}

export function Landing({ plans, template = 'm1' }: { plans: Plan[]; template?: VisualModel }) {
  const plansSection =
    plans.length > 0 ? (
      <section className="pl-section" aria-labelledby="plans-title">
        <p className="pl-eyebrow">Planos</p>
        <h2 id="plans-title" className="pl-h2">
          Escolha os aplicativos da sua operação.
        </h2>
        <PlanCards plans={plans} />
      </section>
    ) : null;

  // ---------- m2 · Vitrine de aplicativos ----------
  if (template === 'm2') {
    return (
      <div className="pl-landing" data-template="m2">
        <section className="pl-section pl-hero" aria-labelledby="hero-title">
          <div className="pl-hero-copy">
            <p className="pl-eyebrow">Plataforma para restaurantes</p>
            <h1 id="hero-title">Um aplicativo para cada área. Uma operação só.</h1>
            <p>Salão, cozinha, caixa, delivery, financeiro e estoque conectados em tempo real — cada equipe na sua tela, com a sua cara.</p>
            <Cta />
          </div>
          <div className="pl-showcase" aria-hidden="true">
            {SHOWCASE.map((s) => (
              <figure key={s.label}>
                <ModelThumb spec={s.thumb} />
                <figcaption>{s.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
        <section className="pl-section" id="aplicativos" aria-labelledby="apps-title">
          <p className="pl-eyebrow">Aplicativos</p>
          <h2 id="apps-title" className="pl-h2">
            Produtos independentes, operação integrada.
          </h2>
          <Modules />
        </section>
        <section className="pl-section pl-band" aria-labelledby="principles-title">
          <h2 id="principles-title" className="pl-h2">
            Simples para quem opera. Seguro para quem é dono.
          </h2>
          <Principles />
        </section>
        {plansSection}
      </div>
    );
  }

  // ---------- m3 · Editorial gastronômico ----------
  if (template === 'm3') {
    return (
      <div className="pl-landing" data-template="m3">
        <section className="pl-section pl-hero" aria-labelledby="hero-title">
          <p className="pl-eyebrow">Para restaurantes de todas as cozinhas</p>
          <h1 id="hero-title">
            Do salão à cozinha, <em>cada área no seu ritmo.</em>
          </h1>
          <p>Bistrôs, hamburguerias, japoneses, cafés, cantinas e casas de açaí usam os mesmos produtos, mesas e preços em aplicativos feitos para cada função.</p>
          <Cta />
        </section>
        <div className="pl-plates" aria-hidden="true">
          {DISHES.map((d) => (
            <span key={d} className="pl-plate">
              <FoodArt name={d} label="" />
              <small>{d}</small>
            </span>
          ))}
        </div>
        <section className="pl-section pl-columns" id="aplicativos" aria-labelledby="apps-title">
          <div>
            <p className="pl-eyebrow">Aplicativos</p>
            <h2 id="apps-title" className="pl-h2">
              Oito aplicativos. Uma só casa.
            </h2>
            <p className="pl-lead">Cada aplicativo tem navegação, tipografia e quatro modelos visuais próprios — escolhidos por quem usa.</p>
          </div>
          <Modules numbered />
        </section>
        <section className="pl-section" aria-labelledby="principles-title">
          <h2 id="principles-title" className="pl-h2">
            O que guia a plataforma
          </h2>
          <Principles />
        </section>
        <section className="pl-section" aria-labelledby="flow-title">
          <h2 id="flow-title" className="pl-h2">
            Do contrato à primeira mesa atendida.
          </h2>
          <Flow />
        </section>
        {plansSection}
      </div>
    );
  }

  // ---------- m4 · Conversão direta ----------
  if (template === 'm4') {
    return (
      <div className="pl-landing" data-template="m4">
        <section className="pl-section pl-hero" aria-labelledby="hero-title">
          <div className="pl-hero-copy">
            <p className="pl-eyebrow">Ponto do Pedido</p>
            <h1 id="hero-title">Organize o restaurante inteiro em uma semana.</h1>
            <ul className="pl-checks">
              {['Pedidos do salão direto para a cozinha', 'Caixa com conferência e fechamento', 'Cardápio por QR Code e delivery próprio', 'Permissões, aprovações e histórico completos'].map((t) => (
                <li key={t}>
                  <Icon name="check" size={18} /> {t}
                </li>
              ))}
            </ul>
            <Cta />
          </div>
          <aside className="pl-hero-card" aria-label="Como começar">
            <h2>Como começar</h2>
            <Flow />
          </aside>
        </section>
        {plansSection}
        <section className="pl-section" id="aplicativos" aria-labelledby="apps-title">
          <h2 id="apps-title" className="pl-h2">
            Tudo o que vem no Ponto do Pedido
          </h2>
          <Modules />
        </section>
        <section className="pl-section pl-final" aria-labelledby="final-title">
          <h2 id="final-title" className="pl-h2">
            Pronto para atender a primeira mesa?
          </h2>
          <Cta />
        </section>
      </div>
    );
  }

  // ---------- m1 · Institucional clássico ----------
  return (
    <div className="pl-landing" data-template="m1">
      <section className="pl-section pl-hero" aria-labelledby="hero-title">
        <p className="pl-eyebrow">Plataforma para restaurantes</p>
        <h1 id="hero-title">Cada área do restaurante no seu próprio aplicativo.</h1>
        <p>
          Atendimento, Cozinha, Caixa, Cardápio Digital, Delivery, Financeiro e Estoque trabalham juntos, com as mesmas mesas, produtos e preços — e cada
          pessoa entra direto na sua área.
        </p>
        <Cta />
        <div className="pl-hero-board" aria-hidden="true">
          <span>
            <strong>
              <Icon name="service" size={16} /> Atendimento
            </strong>
            Mesa 12 · pedido enviado
          </span>
          <span>
            <strong>
              <Icon name="chef" size={16} /> Cozinha
            </strong>
            Pedido #1046 em preparo
          </span>
          <span>
            <strong>
              <Icon name="cash" size={16} /> Caixa
            </strong>
            Comanda quitada
          </span>
          <span>
            <strong>
              <Icon name="dashboard" size={16} /> Gestão
            </strong>
            Mesa liberada
          </span>
        </div>
      </section>
      <section className="pl-section" id="aplicativos" aria-labelledby="apps-title">
        <p className="pl-eyebrow">Aplicativos</p>
        <h2 id="apps-title" className="pl-h2">
          Produtos independentes, operação integrada.
        </h2>
        <Modules />
      </section>
      <section className="pl-section" aria-labelledby="principles-title">
        <p className="pl-eyebrow">Como pensamos</p>
        <h2 id="principles-title" className="pl-h2">
          Simples para quem opera. Seguro para quem é dono.
        </h2>
        <Principles />
      </section>
      <section className="pl-section" aria-labelledby="flow-title">
        <p className="pl-eyebrow">Começo rápido</p>
        <h2 id="flow-title" className="pl-h2">
          Do contrato à primeira mesa atendida.
        </h2>
        <Flow />
      </section>
      {plansSection}
    </div>
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
        Valores e condições comerciais são definidos pela equipe comercial do Ponto do Pedido. Nenhuma cobrança é realizada automaticamente nesta plataforma
        enquanto o meio de pagamento não estiver configurado.
      </p>
    </>
  );
}
