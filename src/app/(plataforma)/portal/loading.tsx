export default function PortalLoading() {
  return (
    <div className="pl-account-state" role="status" aria-live="polite">
      <div className="pl-account-state-main">
        <p className="pl-eyebrow">Portal do Assinante</p>
        <h1>Preparando sua conta<span>.</span></h1>
        <p className="pl-account-state-lead">Estamos carregando seus restaurantes e sua assinatura.</p>
      </div>
    </div>
  );
}
