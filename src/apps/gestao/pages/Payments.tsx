'use client';

import { useState } from 'react';
import { formatCents, parseCents } from '@/core/money';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { Dialog } from '@/core/ui/Dialog';
import { useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { saveDeliveryZone, savePaymentMethod, saveSettings } from '@/apps/gestao/actions';
import { Badge, Empty, PageHead } from '@/apps/gestao/ui';

type Method = { id: string; kind: string; name: string; active: boolean; channels: string[]; position: number };
type Zone = { id: string; name: string; neighborhoods: string[]; fee_cents: number; min_order_cents: number; eta_minutes: number | null; active: boolean };

const KINDS: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito', vale: 'Vale-refeição', outro: 'Outro' };
const CHANNELS: Record<string, string> = { caixa: 'Caixa', atendimento: 'Atendimento', delivery: 'Delivery' };

export function PaymentsPage({ methods, zones, settings, hasDelivery }: { methods: Method[]; zones: Zone[]; settings: Record<string, unknown>; hasDelivery: boolean }) {
  const { tenantId } = useTenant();
  const fee = useAction();
  const [method, setMethod] = useState<Method | 'new' | null>(null);
  const [zone, setZone] = useState<Zone | 'new' | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <>
      <PageHead title="Pagamentos e taxas" subtitle="Formas de pagamento aceitas, taxa de serviço e taxas de entrega." />
      <div className="gs-grid">
        <section className="gs-card" aria-labelledby="formas">
          <div className="gs-cardhead">
            <h2 id="formas" className="gs-h2">
              Formas de pagamento
            </h2>
            <button type="button" className="gs-btn gs-btn--small gs-btn--primary" onClick={() => setMethod('new')}>
              Adicionar
            </button>
          </div>
          {methods.length === 0 ? <Empty>Cadastre ao menos Dinheiro e Pix para receber no Caixa.</Empty> : null}
          <ul className="gs-list">
            {methods.map((m) => (
              <li key={m.id}>
                <span>
                  <strong>{m.name}</strong> <span className="gs-meta">· {KINDS[m.kind]} · {m.channels.map((c) => CHANNELS[c]).join(', ')}</span>
                </span>
                <span className="gs-row">
                  {!m.active ? <Badge>Inativa</Badge> : null}
                  <button type="button" className="gs-btn gs-btn--small" onClick={() => setMethod(m)}>
                    Editar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="gs-card" aria-labelledby="servico">
          <h2 id="servico" className="gs-h2">
            Taxa de serviço (salão)
          </h2>
          <form
            className="gs-row"
            onSubmit={(e) => {
              e.preventDefault();
              const value = Number(String(new FormData(e.currentTarget).get('fee')).replace(',', '.'));
              setSaved(false);
              void fee.run(() => saveSettings(tenantId, { service_fee_percent: value }), {
                onSuccess: () => setSaved(true),
                approval: { kind: 'settings.update', summary: `Taxa de serviço ${value}%`, payload: { patch: { service_fee_percent: value } } },
              });
            }}
          >
            <label className="gs-field">
              Percentual
              <input name="fee" defaultValue={String(settings.service_fee_percent ?? 0)} inputMode="decimal" style={{ width: 120 }} />
            </label>
            <button type="submit" className="gs-btn" disabled={fee.pending} style={{ alignSelf: 'end' }}>
              Salvar
            </button>
          </form>
          <p className="gs-meta" style={{ margin: 0 }}>
            Aplicada às novas comandas do salão. Comandas abertas mantêm a taxa vigente na abertura.
          </p>
          {fee.error ? <p className="gs-msg gs-msg--error">{fee.error.message}</p> : null}
          {saved ? <p className="gs-msg gs-msg--ok">Taxa atualizada.</p> : null}
        </section>
        {hasDelivery ? (
          <section className="gs-card" aria-labelledby="zonas">
            <div className="gs-cardhead">
              <h2 id="zonas" className="gs-h2">
                Regiões e taxas de entrega
              </h2>
              <button type="button" className="gs-btn gs-btn--small gs-btn--primary" onClick={() => setZone('new')}>
                Adicionar
              </button>
            </div>
            {zones.length === 0 ? <Empty>Sem regiões: o delivery não aceita pedidos.</Empty> : null}
            <ul className="gs-list">
              {zones.map((z) => (
                <li key={z.id}>
                  <span>
                    <strong>{z.name}</strong>
                    <span className="gs-meta">
                      {' '}
                      · taxa {formatCents(z.fee_cents)} · mínimo {formatCents(z.min_order_cents)}
                      {z.eta_minutes ? ` · ~${z.eta_minutes} min` : ''}
                    </span>
                  </span>
                  <button type="button" className="gs-btn gs-btn--small" onClick={() => setZone(z)}>
                    Editar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      {method ? <MethodEditor method={method === 'new' ? null : method} onClose={() => setMethod(null)} position={methods.length} /> : null}
      {zone ? <ZoneEditor zone={zone === 'new' ? null : zone} onClose={() => setZone(null)} /> : null}
      <ApprovalDialog tenantId={tenantId} approval={fee.approval} onClose={fee.clearApproval} />
    </>
  );
}

function MethodEditor({ method, onClose, position }: { method: Method | null; onClose: () => void; position: number }) {
  const { tenantId } = useTenant();
  const action = useAction();
  return (
    <Dialog open onClose={onClose} title={method ? method.name : 'Nova forma de pagamento'}>
      <form
        className="gs-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const input = {
            id: method?.id ?? null,
            kind: String(f.get('kind')),
            name: String(f.get('name')),
            active: f.get('active') === 'on',
            channels: f.getAll('channels').map(String),
            position: method?.position ?? position,
          };
          void action.run(() => savePaymentMethod(tenantId, input), {
            onSuccess: onClose,
            approval: { kind: 'payment_method.save', summary: `Salvar forma de pagamento ${input.name}`, payload: { ...input, id: input.id ?? '' } },
          });
        }}
      >
        <div className="gs-form-grid">
          <label className="gs-field">
            Tipo
            <select name="kind" defaultValue={method?.kind ?? 'pix'}>
              {Object.entries(KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="gs-field">
            Nome exibido
            <input name="name" defaultValue={method?.name ?? ''} required />
          </label>
        </div>
        <fieldset className="gs-row" style={{ border: 'none', padding: 0 }}>
          <legend className="gs-meta">Aceita em</legend>
          {Object.entries(CHANNELS).map(([k, v]) => (
            <label key={k} className="gs-check">
              <input type="checkbox" name="channels" value={k} defaultChecked={method ? method.channels.includes(k) : true} /> {v}
            </label>
          ))}
        </fieldset>
        <label className="gs-check">
          <input type="checkbox" name="active" defaultChecked={method?.active ?? true} /> Ativa
        </label>
        {action.error ? <p className="gs-msg gs-msg--error">{action.error.message}</p> : null}
        <button type="submit" className="gs-btn gs-btn--primary" disabled={action.pending}>
          Salvar
        </button>
      </form>
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </Dialog>
  );
}

function ZoneEditor({ zone, onClose }: { zone: Zone | null; onClose: () => void }) {
  const { tenantId } = useTenant();
  const action = useAction();
  return (
    <Dialog open onClose={onClose} title={zone ? zone.name : 'Nova região de entrega'}>
      <form
        className="gs-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const input = {
            id: zone?.id ?? null,
            name: String(f.get('name')),
            neighborhoods: String(f.get('neighborhoods'))
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            fee_cents: parseCents(String(f.get('fee'))) ?? 0,
            min_order_cents: parseCents(String(f.get('min'))) ?? 0,
            eta_minutes: Number(f.get('eta')) || null,
            active: f.get('active') === 'on',
          };
          void action.run(() => saveDeliveryZone(tenantId, input), {
            onSuccess: onClose,
            approval: { kind: 'delivery_zone.save', summary: `Salvar região ${input.name}`, payload: { ...input, id: input.id ?? '' } },
          });
        }}
      >
        <label className="gs-field">
          Nome da região
          <input name="name" defaultValue={zone?.name ?? ''} required />
        </label>
        <label className="gs-field">
          Bairros atendidos
          <input name="neighborhoods" defaultValue={zone?.neighborhoods.join(', ') ?? ''} placeholder="Centro, Jardim América" />
          <small>Separe por vírgulas. O cliente escolhe a região ao informar o endereço.</small>
        </label>
        <div className="gs-form-grid">
          <label className="gs-field">
            Taxa (R$)
            <input name="fee" inputMode="decimal" defaultValue={zone ? (zone.fee_cents / 100).toFixed(2).replace('.', ',') : ''} />
          </label>
          <label className="gs-field">
            Pedido mínimo (R$)
            <input name="min" inputMode="decimal" defaultValue={zone ? (zone.min_order_cents / 100).toFixed(2).replace('.', ',') : ''} />
          </label>
          <label className="gs-field">
            Tempo estimado (min)
            <input name="eta" type="number" min={1} defaultValue={zone?.eta_minutes ?? ''} />
          </label>
        </div>
        <label className="gs-check">
          <input type="checkbox" name="active" defaultChecked={zone?.active ?? true} /> Ativa
        </label>
        {action.error ? <p className="gs-msg gs-msg--error">{action.error.message}</p> : null}
        <button type="submit" className="gs-btn gs-btn--primary" disabled={action.pending}>
          Salvar
        </button>
      </form>
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </Dialog>
  );
}
