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

const ACTIONS: Record<string, string> = {
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
