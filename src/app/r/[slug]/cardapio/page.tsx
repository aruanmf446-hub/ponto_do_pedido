import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CardapioFrame } from '@/apps/cardapio/Frame';
import { CategoryList } from '@/apps/cardapio/MenuView';
import type { MenuCategory } from '@/apps/cardapio/actions';
import { rpcRead } from '@/core/rpc';

export const dynamic = 'force-dynamic';

type PublicMenu = {
  state: 'ok' | 'not_found' | 'unavailable';
  tenant?: { name: string; logo_path: string | null };
  open_now?: boolean;
  categories?: MenuCategory[];
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const menu = await rpcRead<PublicMenu>('public_menu', { p_slug: slug });
  return { title: menu.tenant ? `Cardápio · ${menu.tenant.name}` : 'Cardápio' };
}

export default async function PublicMenuRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const menu = await rpcRead<PublicMenu>('public_menu', { p_slug: slug });
  if (menu.state === 'not_found' || !menu.tenant) notFound();
  if (menu.state !== 'ok') {
    return (
      <CardapioFrame name={menu.tenant.name} logoPath={menu.tenant.logo_path}>
        <div className="cd-message">
          <h1>Cardápio indisponível</h1>
          <p className="cd-desc">O cardápio digital não está disponível no momento.</p>
        </div>
      </CardapioFrame>
    );
  }
  return (
    <CardapioFrame name={menu.tenant.name} logoPath={menu.tenant.logo_path} subtitle="Cardápio">
      <div className="cd-hero">
        <p className="cd-eyebrow">Cardápio</p>
        <h1>Sabores da casa</h1>
        {!menu.open_now ? <p className="cd-warn">O restaurante está fechado no momento.</p> : null}
      </div>
      <CategoryList categories={menu.categories ?? []} />
    </CardapioFrame>
  );
}
