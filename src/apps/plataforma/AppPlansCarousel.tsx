'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Plan } from '@/core/plans';
import { planPriceLabel } from '@/core/plans';

/** Exemplos de combinações e fluxo, não uma promessa dos módulos inclusos em cada plano. */
const STEPS = [
  { title: 'Comece pelo atendimento', apps: ['Atendimento'], flow: ['Mesa', 'Pedido', 'Acompanhamento'] },
  { title: 'Salão e cozinha alinhados', apps: ['Atendimento', 'Cozinha'], flow: ['Mesa', 'Pedido', 'Preparo'] },
  { title: 'Do pedido à conta', apps: ['Atendimento', 'Cozinha', 'Caixa'], flow: ['Pedido', 'Preparo', 'Recebimento'] },
  { title: 'Mais controle da operação', apps: ['Atendimento', 'Cozinha', 'Caixa', 'Gestão'], flow: ['Pedido', 'Produção', 'Fechamento'] },
  { title: 'O cardápio chega à mesa', apps: ['Atendimento', 'Cozinha', 'Caixa', 'Gestão', 'Cardápio'], flow: ['Cardápio', 'Pedido', 'Cozinha'] },
  { title: 'Venda também pelo delivery', apps: ['Atendimento', 'Cozinha', 'Caixa', 'Gestão', 'Cardápio', 'Delivery'], flow: ['Escolha', 'Pedido', 'Entrega'] },
  { title: 'Tudo conectado', apps: ['Atendimento', 'Cozinha', 'Caixa', 'Gestão', 'Cardápio', 'Delivery', 'Estoque'], flow: ['Pedido', 'Produção', 'Estoque'] },
] as const;

export function AppPlansCarousel({ plans }: { plans: Plan[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = window.setInterval(() => setActive((current) => (current + 1) % STEPS.length), 15000);
    return () => window.clearInterval(interval);
  }, [active, paused]);

  const current = STEPS[active] ?? STEPS[0]!;
  const available = plans.filter((plan) => plan.modules.length === active + 1);
  const best = available.reduce<Plan | null>((chosen, plan) => {
    if (!chosen) return plan;
    if (plan.price_cents == null) return chosen;
    return chosen.price_cents == null || plan.price_cents < chosen.price_cents ? plan : chosen;
  }, null);

  return (
    <section
      className="pl-app-story"
      aria-label="Conheça combinações de um a sete aplicativos"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
    >
      <div className="pl-app-story-head">
        <p>DO PRIMEIRO APLICATIVO À OPERAÇÃO COMPLETA</p>
        <div className="pl-app-story-navigation">
          <span aria-live="off">{String(active + 1).padStart(2, '0')} / 07</span>
          <button type="button" aria-label="Aplicativos anteriores" onClick={() => setActive((index) => (index + STEPS.length - 1) % STEPS.length)}>←</button>
          <button type="button" aria-label="Próximos aplicativos" onClick={() => setActive((index) => (index + 1) % STEPS.length)}>→</button>
        </div>
      </div>
      <div className="pl-app-story-slide" aria-live="polite" aria-atomic="true">
        <div className="pl-app-story-title">
          <span>{active + 1} {active === 0 ? 'aplicativo' : 'aplicativos'}</span>
          <h2>{current.title}</h2>
        </div>
        <div className="pl-app-story-apps" aria-label="Aplicativos ilustrativos desta combinação">
          {current.apps.map((app) => <span key={app}>{app}</span>)}
        </div>
        <div className="pl-app-story-diagram" aria-label="Exemplo de processo">
          {current.flow.map((stage, index) => (
            <span key={stage} className="pl-app-story-stage">
              {index > 0 && <span className="pl-app-story-arrow" aria-hidden="true">→</span>}
              <span>{stage}</span>
            </span>
          ))}
        </div>
        <div className="pl-app-story-bottom">
          <span>{best ? planPriceLabel(best) : 'Combinações ilustrativas · consulte os planos'}</span>
          <Link href="/planos">Conheça nossos planos <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      <div className="pl-app-story-dots" aria-label="Quantidade de aplicativos">
        {STEPS.map((_, index) => (
          <button
            type="button"
            key={index}
            className={active === index ? 'is-active' : undefined}
            aria-label={`Mostrar ${index + 1} ${index === 0 ? 'aplicativo' : 'aplicativos'}`}
            aria-current={active === index ? 'step' : undefined}
            onClick={() => setActive(index)}
          >{index + 1}</button>
        ))}
      </div>
    </section>
  );
}
