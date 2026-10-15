import { notFound, redirect } from 'next/navigation';
import { AccessFrame } from '@/apps/acesso/Frame';
import { LoginForm } from '@/apps/acesso/LoginForm';
import { APP_PATHS } from '@/core/apps';
import { createServerSupabase } from '@/core/supabase/server';
import { landingApp, loadContext, tenantBase } from '@/core/tenant/context';

export const dynamic = 'force-dynamic';

type PublicInfo = { id: string; slug: string; name: string; logo_path: string | null; status: string } | null;

export default async function TenantEntry({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { slug } = await params;
  const { next } = await searchParams;
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc('tenant_public_info', { p_slug: slug });
  const info = data as PublicInfo;
  if (!info) notFound();

  const base = await tenantBase();
  const ctx = await loadContext(slug);
  if (ctx.state === 'ok') {
    if (ctx.membership.must_change_password) redirect(`${base}/senha`);
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
    if (safeNext) redirect(`${base}${safeNext}`);
    const app = landingApp(ctx);
    redirect(app ? `${base}${APP_PATHS[app]}` : `${base}/acesso?motivo=sem-permissao`);
  }
  if (ctx.state === 'no_membership' || ctx.state === 'membership_suspended' || ctx.state === 'tenant_inactive') {
    redirect(`${base}/acesso?motivo=${ctx.state === 'tenant_inactive' ? 'assinatura' : ctx.state === 'no_membership' ? 'sem-vinculo' : 'suspenso'}`);
  }

  if (info.status !== 'active') {
    return (
      <AccessFrame tenantName={info.name} logoPath={info.logo_path} title="Acesso temporariamente indisponível">
        <p>A assinatura deste estabelecimento não está ativa. O titular pode regularizá-la no Portal do Assinante.</p>
      </AccessFrame>
    );
  }

  return (
    <AccessFrame tenantName={info.name} logoPath={info.logo_path} title="Acesso da equipe" subtitle="Entre com seu e-mail e senha.">
      <LoginForm slug={slug} next={next ?? null} />
    </AccessFrame>
  );
}
