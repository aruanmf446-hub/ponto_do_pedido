import QRCode from 'qrcode';
import { TablesPage } from '@/apps/gestao/pages/Tables';
import { loadTables } from '@/apps/gestao/queries';
import { absoluteTenantUrl, requireApp } from '@/core/tenant/context';

export default async function TablesRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireApp(slug, 'gestao');
  const { sectors, tables, occupied } = await loadTables(ctx.tenant.id);
  const withQr = await Promise.all(
    tables.map(async (t) => {
      const url = await absoluteTenantUrl(`/cardapio/m/${t.qr_token}`);
      const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
      return { ...t, qr_url: url, qr_svg: svg, occupied: occupied.has(t.id) };
    }),
  );
  return <TablesPage sectors={sectors} tables={withQr} />;
}
