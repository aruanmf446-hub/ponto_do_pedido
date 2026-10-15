import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_TEMPLATES } from '@/apps/plataforma/siteTemplates';
import { config } from '@/core/config';
import { ModelThumb } from '@/core/ui/ModelThumb';

export const metadata: Metadata = { title: 'Modelos do site', robots: { index: false, follow: false } };

/** Prévia dos 4 modelos do site. O modelo publicado é definido em PDP_SITE_TEMPLATE. */
export default function SiteTemplatesPage() {
  return (
    <section className="pl-section" aria-labelledby="t-title">
      <p className="pl-eyebrow">Site institucional</p>
      <h1 id="t-title" className="pl-h2">
        Modelos do site
      </h1>
      <p className="pl-lead">
        Abra cada modelo para ver a página inicial completa. O modelo publicado é definido pela variável <code>PDP_SITE_TEMPLATE</code> (m1 a m4) no
        ambiente de publicação.
      </p>
      <ul className="pl-templates">
        {SITE_TEMPLATES.map((t, i) => (
          <li key={t.id} data-active={t.id === config.siteTemplate}>
            <Link href={`/?modelo=${t.id}`}>
              <ModelThumb spec={t.thumb} />
              <span className="pl-template-text">
                <small>
                  Modelo {i + 1}
                  {t.id === config.siteTemplate ? ' · publicado' : ''}
                </small>
                <strong>{t.name}</strong>
                <span>{t.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
