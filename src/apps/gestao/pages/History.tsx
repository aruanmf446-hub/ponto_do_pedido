import Link from 'next/link';
import { formatDateTime } from '@/core/dates';
import { MODULE_LABEL, PageHead } from '@/apps/gestao/ui';

type Row = {
  id: number;
  at: string;
  actor: string;
  module: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  approval_id: string | null;
  data: Record<string, unknown>;
};

export const ACTIONS: Record<string, string> = {
  'tenant.provisioned': 'Restaurante ativado',
  'license.synced': 'Licença sincronizada',
  'member.attached': 'Colaborador vinculado',
  'member.updated': 'Colaborador alterado',
  'member.roles_set': 'Funções atribuídas',
  'permission.granted': 'Permissão concedida',
  'permission.revoked': 'Permissão revogada',
  'role.saved': 'Função salva',
  'approval.requested': 'Aprovação solicitada',
  'approval.approved': 'Aprovação concedida',
  'approval.rejected': 'Aprovação recusada',
  'approval.executed': 'Ação aprovada executada',
  'tab.opened': 'Comanda aberta',
  'tab.closed': 'Comanda encerrada',
  'tab.auto_closed': 'Comanda quitada e encerrada',
  'order.created': 'Pedido registrado',
  'order.cancelled': 'Pedido cancelado',
  'order.delivered': 'Pedido entregue',
  'payment.received': 'Pagamento recebido',
  'payment.refunded': 'Pagamento estornado',
  'cash.opened': 'Caixa aberto',
  'cash.closed': 'Caixa fechado',
  'cash.sangria': 'Sangria',
  'cash.suprimento': 'Suprimento de caixa',
  'tab.discount': 'Desconto concedido',
  'budget.set': 'Orçamento definido',
  'business_hours.set': 'Horários alterados',
  'category.deleted': 'Categoria excluída',
  'category.saved': 'Categoria salva',
  'delivery.accepted': 'Delivery aceito',
  'delivery.delivered': 'Delivery entregue',
  'delivery.dispatched': 'Delivery saiu para entrega',
  'delivery.rejected': 'Delivery recusado',
  'delivery_zone.saved': 'Área de entrega salva',
  'document.saved': 'Documento arquivado',
  'entry.manual': 'Lançamento financeiro manual',
  'entry.reconciled': 'Lançamento conciliado',
  'inventory.closed': 'Inventário fechado',
  'inventory.started': 'Inventário iniciado',
  'location.saved': 'Local de estoque salvo',
  'lot.blocked': 'Lote bloqueado',
  'lot.released': 'Lote liberado',
  'material.saved': 'Material salvo',
  'material_request.authorized': 'Solicitação de material autorizada',
  'material_request.created': 'Material solicitado',
  'material_request.fulfilled': 'Material entregue',
  'material_request.rejected': 'Solicitação de material recusada',
  'onboarding.finished': 'Configuração inicial concluída',
  'order.customer_confirmed': 'Pedido do cliente confirmado',
  'order.customer_rejected': 'Pedido do cliente recusado',
  'order.issue_resolved': 'Pendência do pedido resolvida',
  'order_item.cancelled': 'Item cancelado',
  'order_item.unavailable': 'Item indisponível',
  'payable.cancelled': 'Conta a pagar cancelada',
  'payable.created': 'Conta a pagar registrada',
  'payable.paid': 'Conta paga',
  'payment_method.saved': 'Forma de pagamento salva',
  'process.ownership_set': 'Responsável por processo alterado',
  'product.availability': 'Disponibilidade de produto alterada',
  'product.deleted': 'Produto excluído',
  'product.saved': 'Produto salvo',
  'purchase.approved': 'Compra aprovada',
  'purchase.ordered': 'Pedido de compra emitido',
  'purchase.quoted': 'Cotação registrada',
  'purchase.received': 'Compra recebida',
  'purchase.rejected': 'Compra recusada',
  'purchase.requested': 'Compra solicitada',
  'receivable.created': 'Conta a receber registrada',
  'receivable.settled': 'Recebível baixado',
  'reimbursement.approved': 'Reembolso aprovado',
  'reimbursement.rejected': 'Reembolso recusado',
  'reimbursement.requested': 'Reembolso solicitado',
  'role.deleted': 'Função excluída',
  'sector.deleted': 'Setor excluído',
  'sector.saved': 'Setor salvo',
  'stock.entry': 'Entrada no estoque',
  'stock.transfer': 'Transferência de estoque',
  'stock.saida': 'Saída do estoque',
  'stock.perda': 'Perda registrada',
  'stock.descarte': 'Descarte registrado',
  'stock.ajuste': 'Ajuste de estoque',
  'supplier.saved': 'Fornecedor salvo',
  'tab.transferred': 'Mesa transferida',
  'table.deleted': 'Mesa excluída',
  'table.qr_rotated': 'QR Code da mesa renovado',
  'table.saved': 'Mesa salva',
  'tenant.info_updated': 'Dados do restaurante alterados',
  'tenant.settings_updated': 'Configurações alteradas',
};

export function HistoryPage({ rows, total, page, module, base, timezone }: { rows: Row[]; total: number; page: number; module: string | null; base: string; timezone: string }) {
  const pages = Math.max(1, Math.ceil(total / 50));
  const link = (m: string | null, p = 0) => `${base}/gestao/historico?${m ? `modulo=${m}&` : ''}pagina=${p}`;
  return (
    <>
      <PageHead title="Histórico e auditoria" subtitle="Quem fez, o quê, quando e com qual autorização." />
      <nav className="gs-tabs" aria-label="Aplicativo">
        <Link href={link(null)} aria-current={!module ? 'page' : undefined}>
          Todos
        </Link>
        {Object.entries(MODULE_LABEL).map(([k, v]) => (
          <Link key={k} href={link(k)} aria-current={module === k ? 'page' : undefined}>
            {v}
          </Link>
        ))}
      </nav>
      <div className="gs-table-wrap">
        <table className="gs-table">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Quem</th>
              <th>App</th>
              <th>Ação</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.at, timezone)}</td>
                <td>{r.actor}</td>
                <td>{r.module ? (MODULE_LABEL[r.module] ?? r.module) : '—'}</td>
                <td>
                  {ACTIONS[r.action] ?? r.action}
                  {r.approval_id ? <span className="gs-meta"> · com aprovação</span> : null}
                </td>
                <td className="gs-meta" style={{ maxWidth: 360, overflowWrap: 'anywhere' }}>
                  {Object.entries(r.data)
                    .filter(([, v]) => v != null && typeof v !== 'object')
                    .slice(0, 4)
                    .map(([k, v]) => `${k}: ${String(v)}`)
                    .join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="gs-row" style={{ marginTop: 12 }}>
        {page > 0 ? (
          <Link className="gs-btn gs-btn--small" href={link(module, page - 1)}>
            Anterior
          </Link>
        ) : null}
        <span className="gs-meta">
          Página {page + 1} de {pages}
        </span>
        {page + 1 < pages ? (
          <Link className="gs-btn gs-btn--small" href={link(module, page + 1)}>
            Próxima
          </Link>
        ) : null}
      </div>
    </>
  );
}
