import { notFound } from 'next/navigation';
import { AccessFrame } from '@/apps/acesso/Frame';
import { signOut } from '@/core/actions';
import { APP_LABELS, APP_PATHS, isInternalApp } from '@/core/apps';
import { config } from '@/core/config';
import { createServerSupabase } from '@/core/supabase/server';
import { accessibleApps, loadContext, tenantBase } from '@/core/tenant/context';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, { title: string; text: string }> = {
  'sem-vinculo': {
    title: 'Usuário sem vínculo',
    text: 'Sua conta não está vinculada a este estabelecimento. Peça ao responsável para cadastrar seu acesso.',
  },
  suspenso: { title: 'Acesso suspenso', text: 'Seu acesso a este estabelecimento foi suspenso pelo responsável.' },
  assinatura: {
    title: 'Assinatura inativa',
    text: 'A assinatura deste estabelecimento está suspensa, cancelada ou vencida. O titular pode regularizá-la no Portal do Assinante.',
  },
  modulo: { title: 'Aplicativo não contratado', text: 'Este aplicativo não faz parte do plano do estabelecimento.' },
  'sem-permissao': { title: 'Acesso não autorizado', text: 'Você não tem permissão para acessar esta área.' },
};

export default async function AccessState({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ motivo?: string; app?: string }>;
}) {
  const { slug } = await params;
  const { motivo = 'sem-permissao', app } = await searchParams;
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc('tenant_public_info', { p_slug: slug });
  const info = data as { name: string; logo_path: string | null } | null;
  if (!info) notFound();
  const base = await tenantBase();
  const ctx = await loadContext(slug);
  const apps = ctx.state === 'ok' ? accessibleApps(ctx) : [];
  const message = MESSAGES[motivo] ?? MESSAGES['sem-permissao']!;
  const isOwnerInactive = ctx.state === 'tenant_inactive' && ctx.is_owner;

  return (
    <AccessFrame tenantName={info.name} logoPath={info.logo_path} title={message.title}>
      <p>
        {message.text}
        {app && isInternalApp(app) ? ` (${APP_LABELS[app]})` : ''}
      </p>
      <div className="ac-actions">
        {apps.map((a) => (
          <a key={a} href={`${base}${APP_PATHS[a]}`}>
            Abrir {APP_LABELS[a]}
          </a>
        ))}
        {isOwnerInactive ? <a href={`https://${config.rootDomain}/portal`}>Portal do Assinante</a> : null}
        {ctx.state !== 'anonymous' ? (
          <form action={signOut}>
            <button type="submit">Sair</button>
          </form>
        ) : (
          <a href={`${base}/`}>Entrar</a>
        )}
      </div>
    </AccessFrame>
  );
}
