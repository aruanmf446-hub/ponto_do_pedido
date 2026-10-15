import { notFound, redirect } from 'next/navigation';
import { DeliveryCentral, type CentralOrder } from '@/apps/delivery/Central';
import { DeliveryFrame } from '@/apps/delivery/Frame';
import { AppSwitcher } from '@/core/ui/AppSwitcher';
import { TenantProvider } from '@/core/ui/TenantProvider';
import { createServerSupabase } from '@/core/supabase/server';
import { accessibleApps, can, hasModule, loadContext, tenantBase } from '@/core/tenant/context';

export const dynamic = 'force-dynamic';

export default async function DeliveryCentralRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const base = await tenantBase();
  const ctx = await loadContext(slug);
  if (ctx.state === 'anonymous') redirect(`${base}/?next=/delivery/central`);
  if (ctx.state === 'tenant_not_found') notFound();
  if (ctx.state !== 'ok') redirect(`${base}/acesso?motivo=${ctx.state === 'tenant_inactive' ? 'assinatura' : 'sem-vinculo'}`);
  if (!hasModule(ctx, 'delivery')) redirect(`${base}/acesso?motivo=modulo`);
  if (!can(ctx, 'delivery.pedido.aceitar') && !can(ctx, 'delivery.pedido.despachar')) redirect(`${base}/acesso?motivo=sem-permissao`);

  const supabase = await createServerSupabase();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [{ data: orders }, { data: methods }] = await Promise.all([
    supabase
      .from('delivery_orders')
      .select(
        'tab_id, status, customer_name, whatsapp, address, fee_cents, change_for_cents, payment_method_id, notes, created_at, zone:delivery_zones(name), tab:tabs(number, total_cents, paid_cents, status, orders(id, status, items:order_items(name, quantity, unit_price_cents, status, notes)))',
      )
      .eq('tenant_id', ctx.tenant.id)
      .in('status', ['awaiting_acceptance', 'accepted', 'out_for_delivery', 'delivered'])
      .gte('created_at', since)
      .order('created_at'),
    supabase.from('payment_methods').select('id, name, kind').eq('tenant_id', ctx.tenant.id).eq('active', true).contains('channels', ['delivery']),
  ]);

  return (
    <TenantProvider
      value={{
        tenantId: ctx.tenant.id,
        slug,
        base,
        timezone: ctx.tenant.timezone,
        model: 'm1',
        permissions: ctx.permissions,
        userId: ctx.membership.user_id,
        isOwner: ctx.membership.is_owner,
      }}
    >
      <DeliveryFrame
        name={ctx.tenant.name}
        logoPath={ctx.tenant.logo_path}
        tools={<AppSwitcher base={base} apps={accessibleApps(ctx)} current="gestao" userName={ctx.membership.display_name} className="dl-switcher" />}
      >
        <DeliveryCentral orders={(orders ?? []) as unknown as CentralOrder[]} methods={(methods ?? []) as { id: string; name: string; kind: string }[]} />
      </DeliveryFrame>
    </TenantProvider>
  );
}
