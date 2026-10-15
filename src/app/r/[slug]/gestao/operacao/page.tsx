import { Forbidden } from '@/apps/gestao/Forbidden';
import { OperationPage } from '@/apps/gestao/pages/Operation';
import { loadOperation } from '@/apps/gestao/queries';
import { absoluteTenantUrl, can, canRequest, requireApp } from '@/core/tenant/context';

export default async function OperationRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'gestao');
  const allowed = ['gestao.operacao.alterar', 'cardapio.configurar', 'delivery.configurar'].some((p) => can(ctx, p) || canRequest(ctx, p));
  if (!allowed) return <Forbidden />;
  const data = await loadOperation(ctx.tenant.id);
  return (
    <OperationPage
      {...data}
      modules={ctx.modules}
      links={{ cardapio: await absoluteTenantUrl('/cardapio'), delivery: await absoluteTenantUrl('/delivery') }}
    />
  );
}
