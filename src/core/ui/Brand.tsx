import { DEVELOPER, PLATFORM_NAME } from '@/core/config';
import { initials, mediaUrl } from '@/core/storage';

// Identidade obrigatória dos aplicativos operacionais:
// - canto superior esquerdo: logo e nome do restaurante;
// - rodapé discreto: aplicativo, Ponto do Pedido, © ano e desenvolvedor.
// A marcação é semântica; cada aplicativo aplica o próprio estilo pelas classes.

export function TenantMark({ name, logoPath, className }: { name: string; logoPath: string | null; className?: string }) {
  const src = mediaUrl(logoPath);
  return (
    <div className={['pdp-tenant-mark', className].filter(Boolean).join(' ')}>
      {src ? (
        <img className="pdp-tenant-logo" src={src} alt={`Logo de ${name}`} width={40} height={40} />
      ) : (
        <span className="pdp-tenant-logo pdp-tenant-logo--initials" aria-hidden="true">
          {initials(name)}
        </span>
      )}
      <span className="pdp-tenant-name">{name}</span>
    </div>
  );
}

export function PlatformFooter({ appName, className }: { appName: string; className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className={['pdp-footer', className].filter(Boolean).join(' ')}>
      <span className="pdp-footer-app">{appName}</span>
      <span className="pdp-footer-sep" aria-hidden="true">
        ·
      </span>
      <span>{PLATFORM_NAME}</span>
      <span className="pdp-footer-sep" aria-hidden="true">
        ·
      </span>
      <span>© {year}</span>
      <span className="pdp-footer-sep" aria-hidden="true">
        ·
      </span>
      <span>
        Desenvolvido por{' '}
        <a href={`https://${DEVELOPER}`} target="_blank" rel="noreferrer">
          {DEVELOPER}
        </a>
      </span>
    </footer>
  );
}
