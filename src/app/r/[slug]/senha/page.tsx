import { notFound, redirect } from 'next/navigation';
import { ChangePasswordForm } from '@/apps/acesso/ChangePasswordForm';
import { AccessFrame } from '@/apps/acesso/Frame';
import { createServerSupabase, getCurrentUser } from '@/core/supabase/server';
import { tenantBase } from '@/core/tenant/context';

export const dynamic = 'force-dynamic';

export default async function ChangePassword({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc('tenant_public_info', { p_slug: slug });
  const info = data as { name: string; logo_path: string | null } | null;
  if (!info) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`${await tenantBase()}/`);
  return (
    <AccessFrame tenantName={info.name} logoPath={info.logo_path} title="Defina sua senha" subtitle="Crie uma senha pessoal para continuar.">
      <ChangePasswordForm slug={slug} />
    </AccessFrame>
  );
}
