import { APP_LABELS, APP_PATHS, type InternalApp } from '@/core/apps';
import { signOut } from '@/core/actions';
import { initials } from '@/core/storage';

/**
 * Acesso às demais áreas autorizadas do usuário (sem tela de seleção após o
 * login) e saída. Menu compacto e semântico; o estilo é do aplicativo.
 */
export function AppSwitcher({
  base,
  apps,
  current,
  userName,
  role,
  extras = [],
  className,
}: {
  base: string;
  apps: InternalApp[];
  current: InternalApp;
  userName: string;
  role?: string | null;
  extras?: { href: string; label: string }[];
  className?: string;
}) {
  const others = apps.filter((app) => app !== current);
  return (
    <details className={['pdp-switcher', className].filter(Boolean).join(' ')}>
      <summary className="pdp-switcher-user" title={userName}>
        <span className="pdp-avatar" aria-hidden="true">
          {initials(userName)}
        </span>
        <span className="pdp-switcher-who">
          <span className="pdp-switcher-name">{userName}</span>
          {role ? <span className="pdp-switcher-role">{role}</span> : null}
        </span>
      </summary>
      <div className="pdp-switcher-menu">
        {others.length + extras.length > 0 ? (
          <nav aria-label="Outras áreas autorizadas" className="pdp-switcher-apps">
            {others.map((app) => (
              <a key={app} href={`${base}${APP_PATHS[app]}`}>
                {APP_LABELS[app]}
              </a>
            ))}
            {extras.map((area) => (
              <a key={area.href} href={`${base}${area.href}`}>
                {area.label}
              </a>
            ))}
          </nav>
        ) : null}
        <form action={signOut}>
          <button type="submit" className="pdp-switcher-exit">
            Sair
          </button>
        </form>
      </div>
    </details>
  );
}
