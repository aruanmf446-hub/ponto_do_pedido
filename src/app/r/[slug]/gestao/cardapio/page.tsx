import { MenuPage } from '@/apps/gestao/pages/Menu';
import { loadCatalog } from '@/apps/gestao/queries';
import { requireApp } from '@/core/tenant/context';

export default async function MenuRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'gestao');
  const data = await loadCatalog(ctx.tenant.id);
  return <MenuPage {...data} />;
}
