import { Movements } from '@/apps/estoque/pages/Movements';
import { loadMovements } from '@/apps/estoque/queries';
import { MOVE_LABEL } from '@/apps/estoque/ui';
import { requireApp, tenantBase } from '@/core/tenant/context';

export default async function MovimentosRoute({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const { slug } = await params;
  const { tipo } = await searchParams;
  const ctx = await requireApp(slug, 'estoque', '/estoque/movimentos');
  const kind = tipo && tipo in MOVE_LABEL ? tipo : null;
  const [data, base] = await Promise.all([loadMovements(ctx.tenant.id, kind), tenantBase()]);
  return <Movements {...data} kind={kind} base={base} timezone={ctx.tenant.timezone} />;
}
