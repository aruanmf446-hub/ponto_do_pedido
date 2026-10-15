import { APP_LABELS, type AppModule } from '@/core/apps';
import { config } from '@/core/config';
import { formatDate } from '@/core/dates';
import type { TenantContext } from '@/core/tenant/context';
import { Badge, PageHead } from '@/apps/gestao/ui';

const ALL: AppModule[] = ['gestao', 'atendimento', 'cozinha', 'caixa', 'cardapio', 'delivery', 'financeiro', 'estoque'];

export function LicensesPage({ ctx }: { ctx: TenantContext }) {
  const portal = config.pathTenants ? '/portal' : `https://${config.rootDomain}/portal`;
  return (
    <>
      <PageHead title="Licenças e módulos" subtitle="Plano e aplicativos contratados para este estabelecimento." />
      <div className="gs-grid">
        <section className="gs-card" aria-labelledby="plano">
          <h2 id="plano" className="gs-h2">
            Plano {ctx.tenant.plan_code?.toUpperCase() ?? '—'}
          </h2>
          <ul className="gs-list">
            <li>
              <span>Situação</span>
              <Badge tone="ok">Ativa</Badge>
            </li>
            <li>
              <span>Vigência até</span>
              <strong>{formatDate(ctx.tenant.license_valid_until)}</strong>
            </li>
          </ul>
          {ctx.membership.is_owner ? (
            <a className="gs-btn gs-btn--primary" href={portal}>
              Gerenciar assinatura no Portal
            </a>
          ) : (
            <p className="gs-meta" style={{ margin: 0 }}>
              Renovação, alteração e cancelamento são feitos somente pelo titular no Portal do Assinante.
            </p>
          )}
        </section>
        <section className="gs-card" aria-labelledby="modulos">
          <h2 id="modulos" className="gs-h2">
            Aplicativos
          </h2>
          <ul className="gs-list">
            {ALL.map((m) => (
              <li key={m}>
                <span>{APP_LABELS[m]}</span>
                {ctx.modules.includes(m) ? <Badge tone="ok">Contratado</Badge> : <Badge>Não incluído</Badge>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
