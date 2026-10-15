import type { Metadata } from 'next';
import { CardapioFrame } from '@/apps/cardapio/Frame';
import { TableMenuView } from '@/apps/cardapio/MenuView';
import type { TableMenu } from '@/apps/cardapio/actions';
import { rpcRead } from '@/core/rpc';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cardápio da mesa', robots: { index: false, follow: false } };

export default async function TableMenuRoute({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { token } = await params;
  const menu = /^[a-f0-9]{20,64}$/.test(token) ? await rpcRead<TableMenu>('public_table_menu', { p_qr: token, p_guest_key: null }) : ({ state: 'invalid_qr' } as TableMenu);
  if (menu.state !== 'ok' || !menu.tenant) {
    return (
      <CardapioFrame name={menu.tenant?.name ?? 'Cardápio'} logoPath={menu.tenant?.logo_path ?? null}>
        <div className="cd-message">
          <h1>{menu.state === 'invalid_qr' ? 'QR Code inválido' : 'Cardápio indisponível'}</h1>
          <p className="cd-desc">
            {menu.state === 'invalid_qr'
              ? 'Este QR Code não é mais válido. Peça ajuda a um atendente.'
              : 'O cardápio digital não está disponível no momento.'}
          </p>
        </div>
      </CardapioFrame>
    );
  }
  return (
    <CardapioFrame name={menu.tenant.name} logoPath={menu.tenant.logo_path} subtitle={`Mesa ${menu.table?.label ?? ''}`}>
      <TableMenuView qr={token} initial={menu} />
    </CardapioFrame>
  );
}
