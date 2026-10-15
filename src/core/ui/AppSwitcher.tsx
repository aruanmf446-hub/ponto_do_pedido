import { APP_LABELS, APP_PATHS, type InternalApp } from '@/core/apps';
import { signOut } from '@/core/actions';

/**
 * Acesso às demais áreas autorizadas do usuário (sem tela de seleção após o
 * login) e saída. Menu compacto e semântico; o estilo é do aplicativo.
 */
export function AppSwitcher({
  base,
  apps,
  current,
  userName,
  className,
}: {
  base: string;
  apps: InternalApp[];
  current: InternalApp;
  userName: string;
  className?: string;
}) {
  const others = apps.filter((app) => app !== current);
  return (
    <details className={['pdp-switcher', className].filter(Boolean).join(' ')}>
      <summary className="pdp-switcher-user" title={userName}>
        {userName}
      </summary>
      <div className="pdp-switcher-menu">
        {others.length > 0 ? (
          <nav aria-label="Outras áreas autorizadas" className="pdp-switcher-apps">
            {others.map((app) => (
              <a key={app} href={`${base}${APP_PATHS[app]}`}>
                {APP_LABELS[app]}
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
