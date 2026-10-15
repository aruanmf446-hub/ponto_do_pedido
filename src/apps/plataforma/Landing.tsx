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

  // ---------- m1 · Padrão: produto em movimento, texto de resultado ----------
  return (
    <div className="pl-landing" data-template="m1">
      <section className="pl-section pl-m1-hero" aria-labelledby="hero-title">
        <div className="pl-m1-hero-copy">
          <span className="pl-m1-pill">Operação do restaurante em tempo real</span>
          <h1 id="hero-title">O pedido sai da mesa. A conta fecha sem erro.</h1>
          <p>
            Garçom, cozinha e caixa trabalham no mesmo pedido. Você acompanha o salão inteiro do celular, sem voltar ao balcão.
          </p>
          <Cta />
        </div>
        <div className="pl-m1-mock" aria-hidden="true">
          <div className="pl-m1-ticket">
            <header>
              <strong>Mesa 12</strong>
              <span>2 pessoas · 19:42</span>
            </header>
            <ul>
              <li>
                <span>1× Risoto de cogumelos</span>
                <b className="pl-m1-s-ok">Na cozinha</b>
              </li>
              <li>
                <span>2× Caipirinha</span>
                <b className="pl-m1-s-done">Servido</b>
              </li>
              <li>
                <span>1× Sobremesa do dia</span>
                <b className="pl-m1-s-wait">Aguardando</b>
              </li>
            </ul>
          </div>
          <div className="pl-m1-board">
            <div>
              <h4>Novo</h4>
              <i>Mesa 7</i>
              <i>Mesa 3</i>
            </div>
            <div>
              <h4>Preparo</h4>
              <i>Mesa 12</i>
            </div>
            <div>
              <h4>Pronto</h4>
              <i>Mesa 9</i>
            </div>
          </div>
        </div>
      </section>

      <section className="pl-section pl-m1-bento" aria-labelledby="bento-title">
        <span className="pl-m1-label">O que muda no seu turno</span>
        <h2 id="bento-title">Menos ida e volta. Menos pergunta na cozinha.</h2>
        <div className="pl-m1-grid">
          <article className="pl-m1-card pl-m1-card--wide">
            <span>Garçom</span>
            <h3>O pedido já está rodando quando você sai da mesa.</h3>
            <p>A cozinha recebe no mesmo instante. Você sabe quando cada prato sai, sem olhar para o balcão.</p>
          </article>
          <article className="pl-m1-card">
            <span>Cozinha</span>
            <h3>Fila na ordem certa.</h3>
            <p>Cada pedido aparece uma vez, na sequência que a casa definiu.</p>
          </article>
          <article className="pl-m1-card">
            <span>Caixa</span>
            <h3>Conta fechada num toque.</h3>
            <p>Divisão e troco calculados. O fechamento do turno sai pronto.</p>
          </article>
          <article className="pl-m1-card pl-m1-card--wide">
            <span>Dono</span>
            <h3>O dia aparece enquanto acontece.</h3>
            <p>Vendas, estoque baixo e pedidos esperando sua decisão, tudo na tela de hoje.</p>
          </article>
        </div>
      </section>

      <section className="pl-section pl-m1-trust" aria-labelledby="trust-title">
        <div className="pl-m1-dark">
          <h2 id="trust-title">Quem faz, pode. Quem não pode, pede aprovação.</h2>
          <p>
            Cada função enxerga só o que precisa. Desconto acima do limite e cancelamento depois do preparo chegam a quem decide.
            Nada some sem registro.
          </p>
        </div>
      </section>

      <section className="pl-section pl-m1-guest" aria-labelledby="guest-title">
        <span className="pl-m1-label">Para quem come</span>
        <h2 id="guest-title">O cardápio é da sua casa. O cliente pede sozinho.</h2>
        <p>
          QR na mesa ou link do delivery, com as suas fotos e a sua identidade. Sua equipe para de repetir o cardápio em voz alta.
        </p>
      </section>

      {plansSection}

      <section className="pl-section pl-m1-final" aria-labelledby="final-title">
        <h2 id="final-title">Abra a próxima sexta com tudo no lugar.</h2>
        <Cta />
        <p className="pl-m1-modules">
          Gestão · Atendimento · Cozinha · Caixa · Cardápio Digital · Delivery · Financeiro · Estoque
        </p>
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
