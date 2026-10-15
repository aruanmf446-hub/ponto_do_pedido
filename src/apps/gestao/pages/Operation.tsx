'use client';

import { useState } from 'react';
import { isVisualModel, type VisualModel } from '@/core/apps';
import { CARDAPIO_TEMPLATES, DELIVERY_TEMPLATES } from '@/core/publicTemplates';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { TemplateGallery } from '@/core/ui/TemplateGallery';
import { useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { saveSettings, setProcessOwnership } from '@/apps/gestao/actions';
import { PageHead } from '@/apps/gestao/ui';

type Process = { process: string; owner: 'interno' | 'externo'; external_system: string | null };

const PROCESS_LABEL: Record<string, string> = {
  estoque: 'Controle de estoque',
  compras: 'Solicitações e pedidos de compra',
  fornecedores: 'Cadastro de fornecedores',
  contas_pagar: 'Contas a pagar',
  contas_receber: 'Contas a receber',
  conciliacao: 'Conciliação e fluxo de caixa',
  orcamentos: 'Orçamentos',
  documentos: 'Contratos e documentos',
  reembolsos: 'Reembolsos',
};

export function OperationPage({
  settings,
  processes,
  modules,
  links,
}: {
  settings: Record<string, unknown>;
  processes: Process[];
  modules: string[];
  links: { cardapio: string; delivery: string };
}) {
  const { tenantId } = useTenant();
  const action = useAction();
  const procAction = useAction();
  const [msg, setMsg] = useState<string | null>(null);
  const save = (patch: Record<string, unknown>, summary: string) => {
    setMsg(null);
    void action.run(() => saveSettings(tenantId, patch), {
      onSuccess: () => setMsg('Configuração salva.'),
      approval: { kind: 'settings.update', summary, payload: { patch } },
    });
  };
  const stages = Array.isArray(settings.kitchen_stages) ? (settings.kitchen_stages as string[]) : [];
  const [templates, setTemplates] = useState<{ cardapio: VisualModel; delivery: VisualModel }>({
    cardapio: isVisualModel(settings.cardapio_template) ? settings.cardapio_template : 'm1',
    delivery: isVisualModel(settings.delivery_template) ? settings.delivery_template : 'm2',
  });
  const chooseTemplate = (channel: 'cardapio' | 'delivery', id: VisualModel) => {
    const previous = templates[channel];
    setTemplates((t) => ({ ...t, [channel]: id }));
    setMsg(null);
    const patch = { [`${channel}_template`]: id };
    void action
      .run(() => saveSettings(tenantId, patch), {
        onSuccess: () => setMsg(channel === 'cardapio' ? 'Modelo do Cardápio Digital atualizado.' : 'Modelo do Delivery atualizado.'),
        approval: { kind: 'settings.update', summary: channel === 'cardapio' ? 'Alterar modelo do Cardápio Digital' : 'Alterar modelo do Delivery', payload: { patch } },
      })
      .then((r) => {
        if (!r.ok) setTemplates((t) => ({ ...t, [channel]: previous }));
      });
  };
  const hasStock = modules.includes('estoque');
  const hasFinance = modules.includes('financeiro');

  return (
    <>
      <PageHead title="Configurações operacionais" subtitle="Regras de cada aplicativo contratado. Alterações valem para todos imediatamente." />
      {action.error ? <p className="gs-msg gs-msg--error">{action.error.message}</p> : null}
      {msg ? <p className="gs-msg gs-msg--ok">{msg}</p> : null}
      {modules.includes('cardapio') || modules.includes('delivery') ? (
        <section className="gs-card gs-templates" id="modelos" aria-labelledby="t-title">
          <h2 id="t-title" className="gs-h2">
            Aparência dos canais do cliente
          </h2>
          <p className="gs-meta">Escolha o modelo visual do Cardápio Digital e do Delivery. O cliente continua podendo alternar entre claro e escuro.</p>
          {modules.includes('cardapio') ? (
            <div className="gs-template-block">
              <div className="gs-template-head">
                <h3>Cardápio Digital</h3>
                <a href={links.cardapio} target="_blank" rel="noreferrer" className="gs-link">
                  Ver cardápio
                </a>
              </div>
              <TemplateGallery options={CARDAPIO_TEMPLATES} current={templates.cardapio} disabled={action.pending} onSelect={(id) => chooseTemplate('cardapio', id)} />
            </div>
          ) : null}
          {modules.includes('delivery') ? (
            <div className="gs-template-block">
              <div className="gs-template-head">
                <h3>Delivery</h3>
                <a href={links.delivery} target="_blank" rel="noreferrer" className="gs-link">
                  Ver delivery
                </a>
              </div>
              <TemplateGallery options={DELIVERY_TEMPLATES} current={templates.delivery} disabled={action.pending} onSelect={(id) => chooseTemplate('delivery', id)} />
            </div>
          ) : null}
        </section>
      ) : null}
      <div className="gs-grid">
        {modules.includes('cardapio') ? (
          <section className="gs-card" id="cardapio" aria-labelledby="c-title">
            <h2 id="c-title" className="gs-h2">
              Cardápio Digital Local
            </h2>
            <form
              className="gs-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                save(
                  { local_order_mode: f.get('mode'), local_order_confirmation: f.get('confirmation') },
                  'Alterar regras do cardápio local',
                );
              }}
            >
              <fieldset className="gs-form" style={{ border: 'none', padding: 0 }}>
                <legend className="gs-meta">Quem registra pedidos nas mesas</legend>
                {[
                  ['consulta', 'Cardápio apenas para consulta'],
                  ['cliente', 'Somente o cliente, pelo QR Code'],
                  ['garcom', 'Somente o garçom (QR mostra o cardápio)'],
                  ['ambos', 'Cliente e garçom'],
                ].map(([value, label]) => (
                  <label key={value} className="gs-check">
                    <input type="radio" name="mode" value={value} defaultChecked={(settings.local_order_mode ?? 'garcom') === value} /> {label}
                  </label>
                ))}
              </fieldset>
              <label className="gs-field">
                Pedidos do cliente
                <select name="confirmation" defaultValue={String(settings.local_order_confirmation ?? 'atendente')}>
                  <option value="atendente">Atendente confirma antes da cozinha</option>
                  <option value="automatica">Seguem direto para a cozinha</option>
                </select>
              </label>
              <button type="submit" className="gs-btn gs-btn--primary" disabled={action.pending}>
                Salvar
              </button>
              <p className="gs-meta" style={{ margin: 0 }}>
                Os QR Codes de cada mesa ficam em Mesas e setores. Cardápio sem mesa: {links.cardapio}
              </p>
            </form>
          </section>
        ) : null}
        {modules.includes('delivery') ? (
          <section className="gs-card" id="delivery" aria-labelledby="d-title">
            <h2 id="d-title" className="gs-h2">
              Delivery
            </h2>
            <form
              className="gs-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                save(
                  {
                    delivery_enabled: f.get('enabled') === 'on',
                    delivery_responsible: f.get('responsible'),
                    delivery_payment_on: f.get('payment_on'),
                    delivery_eta_minutes: Number(f.get('eta')) || null,
                    delivery_whatsapp: String(f.get('whatsapp') ?? '').replace(/\D/g, '') || null,
                  },
                  'Alterar configurações do delivery',
                );
              }}
            >
              <label className="gs-check">
                <input type="checkbox" name="enabled" defaultChecked={settings.delivery_enabled === true} /> Receber pedidos pelo link público
              </label>
              <label className="gs-field">
                Responsável por aceitar pedidos
                <select name="responsible" defaultValue={String(settings.delivery_responsible ?? 'titular')}>
                  <option value="titular">Titular / responsável</option>
                  <option value="administrativo">Administrativo</option>
                  <option value="cozinha">Cozinha</option>
                  <option value="atendimento">Atendimento</option>
                </select>
                <small>A pessoa precisa da permissão “Aceitar ou recusar pedidos de delivery”.</small>
              </label>
              <label className="gs-field">
                Pagamento
                <select name="payment_on" defaultValue={String(settings.delivery_payment_on ?? 'entrega')}>
                  <option value="entrega">Na entrega</option>
                  <option value="antecipado">Antecipado (Pix/link)</option>
                </select>
              </label>
              <div className="gs-form-grid">
                <label className="gs-field">
                  Tempo médio (min)
                  <input name="eta" type="number" min={1} defaultValue={String(settings.delivery_eta_minutes ?? '')} />
                </label>
                <label className="gs-field">
                  WhatsApp do restaurante
                  <input name="whatsapp" inputMode="tel" defaultValue={String(settings.delivery_whatsapp ?? '')} />
                </label>
              </div>
              <button type="submit" className="gs-btn gs-btn--primary" disabled={action.pending}>
                Salvar
              </button>
              <p className="gs-meta" style={{ margin: 0, overflowWrap: 'anywhere' }}>
                Link público do delivery: {links.delivery}
              </p>
            </form>
          </section>
        ) : null}
        <section className="gs-card" aria-labelledby="k-title">
          <h2 id="k-title" className="gs-h2">
            Cozinha e entrega no salão
          </h2>
          <form
            className="gs-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save(
                {
                  kitchen_delivers: f.get('kitchen_delivers') === 'on',
                  kitchen_stages: String(f.get('stages') ?? '')
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 6),
                },
                'Alterar regras da cozinha',
              );
            }}
          >
            <label className="gs-check">
              <input type="checkbox" name="kitchen_delivers" defaultChecked={settings.kitchen_delivers === true} /> A cozinha entrega os pedidos
              (senão, o atendimento retira)
            </label>
            <label className="gs-field">
              Etapas de preparo
              <input name="stages" defaultValue={stages.join(', ')} placeholder="Preparo, Montagem, Finalização" />
              <small>Separe por vírgulas. Usadas pela tela de estações da Cozinha.</small>
            </label>
            <button type="submit" className="gs-btn gs-btn--primary" disabled={action.pending}>
              Salvar
            </button>
          </form>
        </section>
        {hasStock || hasFinance ? (
          <section className="gs-card" id="processos" aria-labelledby="p-title">
            <h2 id="p-title" className="gs-h2">
              Processos internos ou em ERP externo
            </h2>
            <p className="gs-meta" style={{ margin: 0 }}>
              O Ponto do Pedido não integra ERPs. Indique quem controla cada processo: o que for externo deixa de ser exigido aqui, sem
              sincronização e sem bloquear Atendimento, Caixa ou Cozinha.
            </p>
            {procAction.error ? <p className="gs-msg gs-msg--error">{procAction.error.message}</p> : null}
            <ul className="gs-list">
              {processes
                .filter((p) => (p.process === 'estoque' ? hasStock : hasFinance))
                .map((p) => (
                  <li key={p.process}>
                    <span>{PROCESS_LABEL[p.process] ?? p.process}</span>
                    <form
                      className="gs-row"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const owner = String(f.get('owner')) as 'interno' | 'externo';
                        const external = String(f.get('external') ?? '');
                        void procAction.run(() => setProcessOwnership(tenantId, p.process, owner, external), {
                          approval: {
                            kind: 'process.set',
                            summary: `${PROCESS_LABEL[p.process]}: ${owner}`,
                            payload: { process: p.process, owner, external_system: external },
                          },
                        });
                      }}
                    >
                      <select name="owner" className="gs-input" style={{ width: 170 }} defaultValue={p.owner} aria-label="Responsável">
                        <option value="interno">Ponto do Pedido</option>
                        <option value="externo">ERP externo</option>
                      </select>
                      <input name="external" className="gs-input" style={{ width: 160 }} placeholder="Nome do ERP (opcional)" defaultValue={p.external_system ?? ''} />
                      <button type="submit" className="gs-btn gs-btn--small" disabled={procAction.pending}>
                        Salvar
                      </button>
                    </form>
                  </li>
                ))}
            </ul>
          </section>
        ) : null}
      </div>
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
      <ApprovalDialog tenantId={tenantId} approval={procAction.approval} onClose={procAction.clearApproval} />
    </>
  );
}
