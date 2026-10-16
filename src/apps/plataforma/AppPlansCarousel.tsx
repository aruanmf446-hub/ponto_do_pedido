import Link from 'next/link';

/** Uma única ilustração dos fluxos: 1 a 7 apps é evolução, não sete slides. */
export function AppPlansCarousel() {
  return (
    <section className="pl-m1-app-panel" aria-labelledby="hero-applications-title">
      <p className="pl-m1-app-kicker">UMA PLATAFORMA. SEU RITMO.</p>
      <h2 id="hero-applications-title">
        De <span>1 app</span>
        <br />
        até <span>7 apps.</span>
      </h2>
      <p className="pl-m1-app-lead">
        Fluxos e processos desenhados para conectar cada etapa do seu restaurante.
      </p>

      <div className="pl-m1-app-map" role="img" aria-label="Exemplo de crescimento: um aplicativo de atendimento; três aplicativos com cozinha e caixa; até sete aplicativos conectados.">
        <div className="pl-m1-app-map-guide" aria-hidden="true">
          <svg viewBox="0 0 360 48" preserveAspectRatio="none">
            <path d="M28 24H332M318 13L332 24L318 35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="28" cy="24" r="5" fill="currentColor" />
            <circle cx="180" cy="24" r="5" fill="currentColor" />
            <circle cx="332" cy="24" r="5" fill="currentColor" />
          </svg>
        </div>
        <div className="pl-m1-app-map-milestones">
          <div className="pl-m1-app-milestone">
            <strong>01</strong>
            <span>Atendimento</span>
          </div>
          <div className="pl-m1-app-milestone">
            <strong>03</strong>
            <span>+ Cozinha e Caixa</span>
          </div>
          <div className="pl-m1-app-milestone">
            <strong>07</strong>
            <span>Mais áreas conectadas</span>
          </div>
        </div>
        <div className="pl-m1-app-process" aria-hidden="true">
          <span>Pedido</span>
          <b>→</b>
          <span>Preparo</span>
          <b>→</b>
          <span>Recebimento</span>
        </div>
      </div>

      <p className="pl-m1-app-disclaimer">Exemplo ilustrativo. Os aplicativos disponíveis dependem do plano contratado.</p>
      <Link href="/planos" className="pl-btn pl-m1-app-action">
        Conheça nossos planos <span aria-hidden="true">↗</span>
      </Link>
    </section>
  );
}
