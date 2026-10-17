import { createElement } from 'react';
import { AppPlansCarousel } from '@/apps/plataforma/AppPlansCarousel';
import { HeroPanels } from '@/apps/plataforma/HeroPanels';
import Script from 'next/script';
import { azulejo } from '@/apps/plataforma/fonts';
import Link from 'next/link';
import type { VisualModel } from '@/core/apps';
import { planPriceLabel, type Plan } from '@/core/billing';
import { FoodArt } from '@/core/ui/FoodArt';
import { Icon } from '@/core/ui/Icon';
import { ModelThumb } from '@/core/ui/ModelThumb';
import { FLOW, MODULES, PRINCIPLES } from '@/apps/plataforma/content';
import { MODULE_ICON, SHOWCASE } from '@/apps/plataforma/siteTemplates';

/** Pratos de cozinhas diferentes: a plataforma serve a qualquer tipo de restaurante. */
const DISHES = [
  'Prato executivo',
  'Hambúrguer artesanal',
  'Sushi variado',
  'Salada da estação',
  'Massa fresca',
  'Café especial',
  'Açaí na tigela',
  'Sobremesa da casa',
];

function Cta() {
  return (
    <div className="pl-cta">
      <Link href="/contratar" className="pl-btn">
        Testar grátis por 7 dias
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
            <p>
              Salão, cozinha, caixa, delivery, financeiro e estoque conectados em tempo real — cada equipe na sua tela, com a sua
              cara.
            </p>
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
          <p>
            Bistrôs, hamburguerias, japoneses, cafés, cantinas e casas de açaí usam os mesmos produtos, mesas e preços em
            aplicativos feitos para cada função.
          </p>
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
            <p className="pl-lead">
              Cada aplicativo tem navegação, tipografia e quatro modelos visuais próprios — escolhidos por quem usa.
            </p>
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
              {[
                'Pedidos do salão direto para a cozinha',
                'Caixa com conferência e fechamento',
                'Cardápio por QR Code e delivery próprio',
                'Permissões, aprovações e histórico completos',
              ].map((t) => (
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

  // ---------- m1 · Azulejaria: cada pedido encontra seu lugar ----------
  // O elemento leve só observa a entrada das ilustrações. O scroll é nativo, em CSS.
  // connected/disconnectedCallback mantêm o comportamento nas navegações do App Router.
  return createElement(
    'pdp-azulejos',
    { className: `pl-landing ${azulejo.variable}`, 'data-template': 'm1' },
    <>
      <section className="pl-m1-hero" aria-labelledby="hero-title">
        <HeroPanels
          introduction={
            <>
              <h1 id="hero-title">
                <span>Seu salão cheio.</span>
                <span>Sua operação leve.</span>
                <span>Tudo no controle.</span>
              </h1>
              <p>
                O <strong className="pl-m1-brand">Ponto do Pedido</strong> conecta a operação do seu negócio em uma interface limpa e personalizável.
                Não perca o controle do seu restaurante. Tenha tudo na palma da mão.
              </p>
              <Cta />
            </>
          }
          applications={<AppPlansCarousel />}
        />
        <p className="pl-m1-scroll" aria-hidden="true">
          Acompanhe uma sexta <span>↓</span>
        </p>
      </section>

      <section className="pl-m1-night" id="aplicativos" aria-labelledby="night-title">
        <div className="pl-m1-sticky">
          <header className="pl-m1-night-heading">
            <h2 id="night-title">
              A noite inteira,
              <br />
              sem comanda perdida.
            </h2>
            <span aria-hidden="true">Da primeira mesa ao fechamento ↘</span>
          </header>
          <div className="pl-m1-window">
            <ol className="pl-m1-track">
              {[
                {
                  time: '19:42',
                  text: 'Mesa 12 pede e a cozinha recebe no mesmo segundo.',
                  art: 'mesa',
                  label: 'Mesa posta com uma travessa, pronta para receber o pedido.',
                },
                {
                  time: '20:05',
                  text: 'O prato sai. O garçom já sabe, sem ir ao balcão.',
                  art: 'cozinha',
                  label: 'Trilho de cozinha com três pedidos e pratos no balcão.',
                },
                {
                  time: '21:30',
                  text: 'A conta sai na mesa, dividida em duas.',
                  art: 'conta',
                  label: 'Conta dividida em duas colunas, uma para cada pessoa.',
                },
                {
                  time: '22:10',
                  text: 'Você fecha a sexta e vê o que vendeu, o que acabou e o que espera você.',
                  art: 'sexta',
                  label: 'Calendário de sexta-feira ao lado do restaurante vazio, após o fechamento.',
                },
              ].map((panel, index) => (
                <li className="pl-m1-panel" key={panel.time} data-m1-draw="">
                  <svg className="pl-m1-drawing" viewBox="0 0 560 400" role="img" aria-label={panel.label}>
                    <use href={`/plataforma/noite.svg#${panel.art}`} />
                  </svg>
                  <div className="pl-m1-panel-copy">
                    <p className="pl-m1-time">
                      <time>{panel.time}</time>
                      <span aria-hidden="true">—</span>
                    </p>
                    <h3>{panel.text}</h3>
                    {index === 0 && <p className="pl-m1-example">Cena e horários ilustrativos.</p>}
                    {index === 1 && (
                      <p className="pl-m1-kitchen-status">
                        <span>Pronto</span> A cozinha avisa. O salão segue.
                      </p>
                    )}
                  </div>
                  <div className="pl-m1-progress" aria-hidden="true">
                    {['19:42', '20:05', '21:30', '22:10'].map((time, step) => (
                      <span key={time} data-current={step === index}>
                        {time}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="pl-m1-trust" aria-labelledby="trust-title" data-m1-draw="">
        <div className="pl-m1-trust-copy">
          <h2 id="trust-title">
            Quem manda,
            <br />
            decide.
            <br />
            Quem não pode,
            <br />
            pede.
          </h2>
          <p>Desconto acima do limite e cancelamento depois do preparo param em quem pode liberar. Fica registrado.</p>
        </div>
        <div className="pl-m1-flow" role="img" aria-label="Fluxo: solicitação, quem pode decidir, registrado.">
          <svg className="pl-m1-flow-line" viewBox="0 0 360 600" preserveAspectRatio="none" aria-hidden="true">
            <path d="M60 95V505" />
            <path className="pl-m1-flow-arrow pl-m1-flow-arrow--one" pathLength="100" d="M60 160V230M50 218L60 230L70 218" />
            <path className="pl-m1-flow-arrow pl-m1-flow-arrow--two" pathLength="100" d="M60 360V430M50 418L60 430L70 418" />
          </svg>
          <div className="pl-m1-flow-step" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <use href="/plataforma/fluxo.svg#solicitacao" />
            </svg>
            <span>Solicitação</span>
          </div>
          <div className="pl-m1-flow-step" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <use href="/plataforma/fluxo.svg#decisao" />
            </svg>
            <span>Quem pode decidir</span>
          </div>
          <div className="pl-m1-flow-step" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <use href="/plataforma/fluxo.svg#registro" />
            </svg>
            <span>Registrado</span>
          </div>
        </div>
      </section>

      <section className="pl-m1-guest" aria-labelledby="guest-title">
        <div className="pl-m1-guest-copy">
          <h2 id="guest-title">
            O cardápio vai
            <br />
            para a mão
            <br />
            de quem senta.
          </h2>
          <p>
            QR na mesa ou link no delivery.
            <br />
            Suas fotos, seus preços, sua ordem.
          </p>
        </div>
        <svg
          className="pl-m1-phone"
          viewBox="0 0 360 680"
          role="img"
          aria-label="Celular com o cardápio ilustrativo do Bistrô do Largo, restaurante fictício, sem preços."
        >
          <use href="/plataforma/cardapio.svg#cardapio" />
        </svg>
      </section>

      <section className="pl-m1-final" aria-labelledby="final-title">
        <div className="pl-m1-final-tile">
          <svg className="pl-m1-flower" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
            <path d="M32 4C40 18 42 24 32 32C22 24 24 18 32 4ZM60 32C46 40 40 42 32 32C40 22 46 24 60 32ZM32 60C24 46 22 40 32 32C42 40 40 46 32 60ZM4 32C18 24 24 22 32 32C24 42 18 40 4 32Z" />
            <circle cx="32" cy="32" r="4" />
          </svg>
          <h2 id="final-title">
            Sexta que vem
            <br />
            começa com
            <br />a mesa 1.
          </h2>
          <Cta />
        </div>
      </section>
      <Script id="pl-m1-azulejos">{`
        if (!customElements.get('pdp-azulejos')) {
          customElements.define('pdp-azulejos', class extends HTMLElement {
            connectedCallback() {
              this.motion = matchMedia('(prefers-reduced-motion: reduce)');
              this.complete = () => {
                this.observer?.disconnect();
                this.querySelectorAll('[data-m1-draw]').forEach(el => el.classList.remove('pl-m1-draw-pending'));
              };
              if (!this.motion.matches && 'IntersectionObserver' in window) {
                this.observer = new IntersectionObserver(entries => {
                  entries.forEach(entry => {
                    if (entry.isIntersecting) {
                      entry.target.classList.remove('pl-m1-draw-pending');
                      this.observer.unobserve(entry.target);
                    }
                  });
                }, { rootMargin: '-15% -20%', threshold: 0.15 });
                this.querySelectorAll('[data-m1-draw]').forEach(el => {
                  el.classList.add('pl-m1-draw-pending');
                  this.observer.observe(el);
                });
              }
              this.motion.addEventListener('change', this.complete);
            }
            disconnectedCallback() {
              this.observer?.disconnect();
              this.motion?.removeEventListener('change', this.complete);
            }
          });
        }
      `}</Script>
    </>,
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
              Testar {plan.name} por 7 dias
            </Link>
          </article>
        ))}
      </div>
      <p className="pl-note">
        Teste grátis de 7 dias, sem cartão e sem cobrança automática, uma vez por titular. Depois, escolha o plano e pague para continuar.
        Valores e condições dos planos são os exibidos no catálogo oficial.
      </p>
    </>
  );
}
