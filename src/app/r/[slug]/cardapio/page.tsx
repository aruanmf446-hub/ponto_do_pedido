import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CardapioFrame } from '@/apps/cardapio/Frame';
import { MenuBody, MenuHero } from '@/apps/cardapio/MenuView';
import type { MenuCategory } from '@/apps/cardapio/actions';
import { parsePublicTemplates } from '@/core/publicTemplates';
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
  const [menu, templates] = await Promise.all([rpcRead<PublicMenu>('public_menu', { p_slug: slug }), rpcRead<unknown>('public_templates', { p_slug: slug })]);
  if (menu.state === 'not_found' || !menu.tenant) notFound();
  const template = parsePublicTemplates(templates).cardapio;
  if (menu.state !== 'ok') {
    return (
      <CardapioFrame name={menu.tenant.name} logoPath={menu.tenant.logo_path} template={template}>
        <div className="cd-message">
          <h1>Cardápio indisponível</h1>
          <p className="cd-desc">O cardápio digital não está disponível no momento.</p>
        </div>
      </CardapioFrame>
    );
  }
  return (
    <CardapioFrame name={menu.tenant.name} logoPath={menu.tenant.logo_path} subtitle="Cardápio" template={template}>
      <MenuBody
        template={template}
        categories={menu.categories ?? []}
        hero={
          <MenuHero
            template={template}
            eyebrow={menu.tenant.name}
            title={template === 'm2' ? 'Sabores que dão vontade' : template === 'm3' ? 'Uma experiência à mesa' : 'Bem-vindo ao nosso cardápio'}
            text="Conheça os pratos, bebidas e sobremesas da casa."
            warn={!menu.open_now ? 'O restaurante está fechado no momento.' : null}
            categories={menu.categories ?? []}
          />
        }
      />
    </CardapioFrame>
  );
}
