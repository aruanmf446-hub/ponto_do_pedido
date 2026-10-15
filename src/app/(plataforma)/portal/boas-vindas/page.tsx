import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Welcome, type OnboardingState } from '@/apps/plataforma/Welcome';
import { rpcRead } from '@/core/rpc';
import { getCurrentUser } from '@/core/supabase/server';

export const metadata: Metadata = { title: 'Bem-vindo' };

type MyTenant = { id: string; slug: string; name: string; is_owner: boolean };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  if (!(await getCurrentUser())) redirect('/entrar?next=/portal');
  const tenants = await rpcRead<MyTenant[]>('my_tenants', {});
  const tenant = tenants.find((t) => t.slug === r && t.is_owner) ?? tenants.find((t) => t.is_owner);
  if (!tenant) redirect('/portal');
  const state = await rpcRead<OnboardingState>('onboarding_state', { p_tenant: tenant.id });
  return <Welcome tenantId={tenant.id} slug={tenant.slug} name={tenant.name} state={state} />;
}
