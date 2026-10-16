'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Plan } from '@/core/plans';
import { planPriceLabel } from '@/core/plans';

const steps = [
  { title: 'O primeiro passo', flow: ['Atendimento', 'Mesas e pedidos', 'Fluxo organizado'] },
  { title: 'Áreas conectadas', flow: ['Atendimento', 'Cozinha', 'Pedido em produção'] },
  { title: 'Da mesa ao recebimento', flow: ['Atendimento', 'Cozinha', 'Caixa'] },
  { title: 'A rotina ganha controle', flow: ['Atendimento', 'Cozinha', 'Caixa', 'Gestão'] },
  { title: 'O cliente participa', flow: ['Atendimento', 'Cozinha', 'Caixa', 'Gestão', 'Cardápio'] },
  { title: 'Mais canais para vender', flow: ['Atendimento', 'Cozinha', 'Caixa', 'Gestão', 'Cardápio', 'Delivery'] },
  { title: 'Uma operação mais completa', flow: ['Atendimento', 'Cozinha', 'Caixa', 'Gestão', 'Cardápio', 'Delivery', 'Estoque'] },
];

export function AppPlansCarousel({ plans }: { plans: Plan[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % steps.length), 15000);
    return () => window.clearInterval(timer);
  }, [paused]);

  const step = steps[active] ?? steps[0]!;
  const available = plans.filter((plan) => plan.modules.length === active + 1);
  const lowestPriced = available.reduce<Plan | null>((best, plan) => {
    if (!best) return plan;
    if (plan.price_cents == null) return best;
    return best.price_cents == null || plan.price_cents < best.price_cents ? plan : best;
  }, null);
  return (
    <section className="pl-app-story" aria-labelledby="app-story-title" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
      <div className="pl-app-story-head">
        <div><p className="pl-app-story-kicker">Uma operação que cresce com você</p><h2 id="app-story-title">De 1 a 7 aplicativos.<br />Do seu jeito.</h2></div>
        <div className="pl-app-story-navigation">
          <span aria-live="polite">{String(active + 1).padStart(2, '0')} / 07</span>
          <button type="button" onClick={() => setActive((value) => (value + 6) % 7)} aria-label="Etapa anterior">←</button>
          <button type="button" onClick={() => setActive((value) => (value + 1) % 7)} aria-label="Próxima etapa">→</button>
        </div>
      </div>
      <div className="pl-app-story-content" aria-live="polite" aria-atomic="true">
        <div className="pl-app-story-text">
          <span className="pl-app-story-number">{active + 1} {active === 0 ? 'aplicativo' : 'aplicativos'}</span>
          <h3>{step.title}</h3>
          <p>Veja um exemplo de como as áreas podem se conectar. Os aplicativos incluídos dependem do plano escolhido.</p>
          {lowestPriced ? <p className="pl-app-story-price">Planos disponíveis: {planPriceLabel(lowestPriced)}</p> : <p className="pl-app-story-price">Consulte as opções disponíveis</p>}
          <Link href="/planos" className="pl-btn">Conheça nossos planos ↗</Link>
        </div>
        <div className="pl-app-story-diagram" aria-label="Exemplo ilustrativo de fluxo entre aplicativos">
          {step.flow.map((item, index) => (
            <div className="pl-app-story-node" key={item}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{item}</strong>
              {index < step.flow.length - 1 && <i aria-hidden="true">↓</i>}
            </div>
          ))}
        </div>
      </div>
      <div className="pl-app-story-dots" aria-label="Escolha a quantidade de aplicativos">
        {steps.map((_, index) => <button key={index} type="button" onClick={() => setActive(index)} aria-current={active === index ? 'step' : undefined} aria-label={`Mostrar ${index + 1} aplicativos`} className={active === index ? 'is-active' : ''}>{index + 1}</button>)}
      </div>
    </section>
  );
}
