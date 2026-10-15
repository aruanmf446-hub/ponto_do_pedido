import type { ReactNode } from 'react';
import { PlatformChrome } from '@/apps/plataforma/Chrome';
import { getCurrentUser } from '@/core/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return <PlatformChrome signedIn={!!user}>{children}</PlatformChrome>;
}
