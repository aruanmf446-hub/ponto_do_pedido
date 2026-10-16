'use client';

import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react';

/** Dois painéis da mesma abertura; no celular, deslizam lateralmente em vez de empilhar. */
export function HeroPanels({ introduction, applications }: { introduction: ReactNode; applications: ReactNode }) {
  const [mobile, setMobile] = useState(false);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 899px)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!mobile || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setActive((value) => 1 - value), 15000);
    return () => window.clearInterval(timer);
  }, [mobile, paused, active]);

  function startSwipe(event: TouchEvent<HTMLDivElement>) {
    const point = event.changedTouches[0];
    if (point) touch.current = { x: point.clientX, y: point.clientY };
  }

  function endSwipe(event: TouchEvent<HTMLDivElement>) {
    const point = event.changedTouches[0];
    const origin = touch.current;
    touch.current = null;
    if (!mobile || !origin || !point) return;
    const dx = point.clientX - origin.x;
    const dy = point.clientY - origin.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      setActive(dx < 0 ? 1 : 0);
    }
  }

  return (
    <div
      className="pl-m1-hero-layout"
      data-mobile={mobile}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div
        className="pl-m1-hero-slides"
        data-active={active}
        onTouchStart={startSwipe}
        onTouchEnd={endSwipe}
      >
        <div className="pl-m1-hero-copy" inert={mobile && active !== 0}>
          {introduction}
        </div>
        <div className="pl-m1-hero-plan" inert={mobile && active !== 1}>
          {applications}
        </div>
      </div>
      <nav className="pl-m1-hero-switch" aria-label="Alternar as duas telas de abertura">
        <button type="button" onClick={() => setActive(0)} aria-label="Tela inicial" disabled={active === 0}>←</button>
        <span aria-live="polite">{String(active + 1).padStart(2, '0')} / 02</span>
        <button type="button" onClick={() => setActive(1)} aria-label="Tela dos aplicativos" disabled={active === 1}>→</button>
      </nav>
    </div>
  );
}
