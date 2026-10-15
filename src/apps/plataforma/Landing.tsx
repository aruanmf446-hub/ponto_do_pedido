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

  // ---------- m1 · Padrão: comandas de uma sexta à noite ----------
  return (
    <div className="pl-landing" data-template="m1">
      <section className="pl-section pl-m1-hero" aria-labelledby="hero-title">
        <div className="pl-m1-hero-copy">
          <h1 id="hero-title">Sexta, 20h. Salão cheio. Nenhum pedido perdido.</h1>
          <p>Cada comanda segue da mesa para a cozinha e volta como conta fechada. Você acompanha tudo do celular.</p>
          <Cta />
        </div>
        <div className="pl-m1-sheets" aria-hidden="true">
          <div className="pl-m1-sheet pl-m1-sheet--caixa">
            <h3>Via do caixa</h3>
            <p>Total da mesa 12</p>
            <p>Dividir em 2</p>
          </div>
          <div className="pl-m1-sheet pl-m1-sheet--cozinha">
            <h3>Via da cozinha</h3>
            <ul>
              <li>1× Risoto de cogumelos</li>
              <li>2× Caipirinha</li>
            </ul>
          </div>
          <div className="pl-m1-sheet pl-m1-sheet--mesa">
            <header>
              <strong>Mesa 12</strong>
              <time>19:42</time>
            </header>
            <ul>
              <li>
                1× Risoto de cogumelos <b>Na cozinha</b>
              </li>
              <li>
                2× Caipirinha <b>Servido</b>
              </li>
              <li>
                1× Sobremesa do dia <b>Aguardando</b>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="pl-section pl-m1-night" aria-labelledby="night-title">
        <h2 id="night-title">A noite, do ponto de vista da casa.</h2>
        <ol className="pl-m1-rows">
          <li>
            <time>19:42</time>
            <p>O garçom anota na mesa. A cozinha recebe no mesmo instante.</p>
          </li>
          <li>
            <time>20:05</time>
            <p>O prato sai. O garçom já sabe, sem perguntar no balcão.</p>
          </li>
          <li>
            <time>21:30</time>
            <p>A conta sai na mesa, com a divisão feita.</p>
          </li>
          <li>
            <time>22:10</time>
            <p>Você fecha o dia e vê o que vendeu, o que acabou e o que espera a sua decisão.</p>
          </li>
        </ol>
      </section>

      <section className="pl-section pl-m1-trust" aria-labelledby="trust-title">
        <div className="pl-m1-dark">
          <h2 id="trust-title">Quem não pode decidir, pede. Quem pode, decide.</h2>
          <p>
            Cada função vê só o que usa. Pedidos de exceção, como desconto acima do limite ou cancelamento depois do preparo,
            param em quem pode liberar. Tudo fica registrado.
          </p>
        </div>
      </section>

      <section className="pl-section pl-m1-guest" aria-labelledby="guest-title">
        <h2 id="guest-title">O cliente lê o cardápio no celular, com a cara da sua casa.</h2>
        <p>QR na mesa ou link no delivery. Suas fotos, seus preços, sua ordem.</p>
      </section>

      {plansSection}

      <section className="pl-section pl-m1-final" aria-labelledby="final-title">
        <h2 id="final-title">Próxima sexta, mesma hora.</h2>
        <Cta />
        <ul className="pl-m1-modules" aria-label="Módulos incluídos">
          <li>Gestão</li>
          <li>Atendimento</li>
          <li>Cozinha</li>
          <li>Caixa</li>
          <li>Cardápio Digital</li>
          <li>Delivery</li>
          <li>Financeiro</li>
          <li>Estoque</li>
        </ul>
      </section>
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
        Valores e condições comerciais são definidos pela equipe comercial do Ponto do Pedido. Nenhuma cobrança é realizada
        automaticamente nesta plataforma enquanto o meio de pagamento não estiver configurado.
      </p>
    </>
  );
}
