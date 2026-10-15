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

  // ---------- m1 · Padrão: o caminho do pedido, para quem decide ----------
  return (
    <div className="pl-landing" data-template="m1">
      <section className="pl-section pl-m1-hero" aria-labelledby="hero-title">
        <p className="pl-m1-kicker">Para donos de restaurante</p>
        <h1 id="hero-title">O salão anda sozinho quando cada pedido sabe o próprio caminho.</h1>
        <p className="pl-m1-lede">
          O garçom lança na mesa, a cozinha recebe na hora, o caixa fecha sem redigitar. Você acompanha o dia inteiro do celular.
        </p>
        <Cta />
        <ol className="pl-m1-path" aria-label="Caminho de um pedido">
          <li>
            <span>19:42</span>
            <strong>Mesa 12 pede</strong>
            <em>direto do garçom</em>
          </li>
          <li>
            <span>19:43</span>
            <strong>Cozinha recebe</strong>
            <em>na ordem certa</em>
          </li>
          <li>
            <span>20:05</span>
            <strong>Prato sai</strong>
            <em>e o garçom é avisado</em>
          </li>
          <li>
            <span>21:30</span>
            <strong>Conta fecha</strong>
            <em>mesa liberada</em>
          </li>
        </ol>
        <p className="pl-m1-note">Horários ilustrativos.</p>
      </section>

      <section className="pl-section pl-m1-night" aria-labelledby="night-title">
        <div>
          <p className="pl-m1-kicker">Uma sexta-feira, do ponto de vista da casa</p>
          <h2 id="night-title" className="pl-h2">
            Cada pessoa do turno faz a parte dela sem pedir ajuda ao colega.
          </h2>
        </div>
        <div className="pl-m1-roles">
          <article>
            <h3>Garçom</h3>
            <p>Anota na mesa, envia para a cozinha e sabe quando o prato sai. Não volta ao balcão a cada pedido.</p>
          </article>
          <article>
            <h3>Cozinha</h3>
            <p>Uma fila que segue a ordem de chegada e as prioridades da casa. Nenhum ticket perdido na bancada.</p>
          </article>
          <article>
            <h3>Caixa</h3>
            <p>A conta sai com o que foi consumido, a divisão e o troco. O fechamento do turno já vem pronto.</p>
          </article>
          <article>
            <h3>Dono</h3>
            <p>Vê o dia enquanto ele acontece: o que vendeu, o que falta no estoque, o que espera a sua decisão.</p>
          </article>
        </div>
      </section>

      <section className="pl-section pl-band pl-m1-trust" aria-labelledby="trust-title">
        <h2 id="trust-title" className="pl-h2">
          A decisão é sua. Quem trabalha com você faz só o que lhe foi dado.
        </h2>
        <p>
          Cada pessoa entra na área da função dela. Quando algo sai do combinado, como um desconto maior ou um cancelamento depois
          do preparo, o pedido vai para quem pode aprovar. Nada disso some sem registro.
        </p>
      </section>

      <section className="pl-section pl-m1-guest" aria-labelledby="guest-title">
        <p className="pl-m1-kicker">Do lado de quem come</p>
        <h2 id="guest-title" className="pl-h2">
          O cliente escolhe sozinho, com a cara da sua casa.
        </h2>
        <p className="pl-m1-lede">
          Cardápio pelo QR da mesa ou pelo link do delivery, com o seu nome, as suas fotos e os seus preços. Sua equipe deixa de
          repetir o cardápio em voz alta.
        </p>
      </section>

      {plansSection}

      <section className="pl-section pl-m1-final" aria-labelledby="final-title">
        <h2 id="final-title" className="pl-h2">
          Sua próxima sexta começa com a primeira mesa.
        </h2>
        <Cta />
        <p className="pl-m1-note">Gestão · Atendimento · Cozinha · Caixa · Cardápio Digital · Delivery · Financeiro · Estoque</p>
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
