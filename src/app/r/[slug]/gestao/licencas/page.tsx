import { Forbidden } from '@/apps/gestao/Forbidden';
import { LicensesPage } from '@/apps/gestao/pages/Licenses';
import { can, requireApp } from '@/core/tenant/context';

export default async function LicensesRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'gestao');
  if (!can(ctx, 'gestao.licencas.visualizar')) return <Forbidden />;
  return <LicensesPage ctx={ctx} />;
}
