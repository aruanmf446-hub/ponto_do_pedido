import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/core/ui/Icon';

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="fn-pagehead">
      <div>
        <h1 className="fn-h1">{title}</h1>
        {subtitle ? <p className="fn-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="fn-row">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, children, actions, className }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={['fn-panel', className].filter(Boolean).join(' ')}>
      {title || actions ? (
        <header className="fn-panel-head">
          {title ? <h2 className="fn-h2">{title}</h2> : <span />}
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, tone, icon, hint }: { label: string; value: ReactNode; tone?: 'ok' | 'warn' | 'danger'; icon?: IconName; hint?: string }) {
  return (
    <div className="fn-stat" data-tone={tone}>
      {icon ? (
        <span className="fn-stat-icon">
          <Icon name={icon} size={20} />
        </span>
      ) : null}
      <span className="fn-stat-label">{label}</span>
      <span className="fn-stat-value">{value}</span>
      {hint ? <span className="fn-stat-hint">{hint}</span> : null}
    </div>
  );
}

export function Badge({ tone, children }: { tone?: 'ok' | 'warn' | 'danger' | 'accent'; children: ReactNode }) {
  return (
    <span className="fn-badge" data-tone={tone}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="fn-empty">{children}</p>;
}

/** Processo marcado como controlado no ERP externo: apenas consulta. */
export function ExternalNotice({ label }: { label: string }) {
  return (
    <p className="fn-external" role="note">
      {label} está definido como responsabilidade do ERP/sistema externo deste estabelecimento. Aqui ficam apenas consultas; a alteração é feita na Gestão → Operação.
    </p>
  );
}

export const STATUS_LABEL: Record<string, string> = {
  requested: 'Solicitado',
  quoting: 'Em cotação',
  approved: 'Aprovado',
  rejected: 'Recusado',
  ordered: 'Pedido emitido',
  received: 'Recebido',
  cancelled: 'Cancelado',
  issued: 'Emitido',
  partially_received: 'Recebido parcial',
  open: 'Em aberto',
  paid: 'Pago',
  authorized: 'Autorizado',
  fulfilled: 'Atendido',
  purchase_requested: 'Em compra',
};

export function statusTone(status: string): 'ok' | 'warn' | 'danger' | 'accent' | undefined {
  if (['approved', 'received', 'paid', 'fulfilled', 'authorized'].includes(status)) return 'ok';
  if (['rejected', 'cancelled'].includes(status)) return 'danger';
  if (['requested', 'quoting', 'open'].includes(status)) return 'warn';
  return 'accent';
}

export const DOC_KINDS: Record<string, string> = {
  contrato: 'Contrato',
  nota_fiscal: 'Nota fiscal',
  comprovante: 'Comprovante',
  orcamento: 'Orçamento',
  outro: 'Outro',
};

/** Data AAAA-MM-DD → DD/MM/AAAA (sem conversão de fuso). */
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
