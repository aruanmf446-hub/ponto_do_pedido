'use client';

import { useState } from 'react';
import { WEEKDAYS } from '@/core/dates';
import { browserSupabase } from '@/core/supabase/browser';
import { mediaUrl } from '@/core/storage';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { saveBusinessHours, saveTenantInfo } from '@/apps/gestao/actions';
import { PageHead } from '@/apps/gestao/ui';

type Hours = { weekday: number; opens: string; closes: string }[];

const TIMEZONES = ['America/Sao_Paulo', 'America/Manaus', 'America/Cuiaba', 'America/Belem', 'America/Fortaleza', 'America/Recife', 'America/Bahia', 'America/Porto_Velho', 'America/Rio_Branco', 'America/Noronha'];

export function RestaurantPage({
  tenant,
  hours,
  canEdit,
  canEditHours,
  publicLinks,
}: {
  tenant: Record<string, unknown> & { address: Record<string, string> };
  hours: Hours;
  canEdit: boolean;
  canEditHours: boolean;
  publicLinks: { label: string; url: string }[];
}) {
  const { tenantId } = useTenant();
  const info = useAction();
  const hoursAction = useAction();
  const [saved, setSaved] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>((tenant.logo_path as string | null) ?? null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rows, setRows] = useState<Hours>(hours.length ? hours.map((h) => ({ ...h, opens: h.opens.slice(0, 5), closes: h.closes.slice(0, 5) })) : []);

  const uploadLogo = async (file: File) => {
    setUploadError(null);
    if (file.size > 5 * 1024 * 1024) return setUploadError('A imagem deve ter até 5 MB.');
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `${tenantId}/logo-${Date.now()}.${ext}`;
    const { error } = await browserSupabase().storage.from('tenant-media').upload(path, file, { upsert: false, contentType: file.type });
    if (error) return setUploadError('Não foi possível enviar a imagem.');
    setLogo(path);
  };

  return (
    <>
      <PageHead title="Informações do restaurante" subtitle="Dados oficiais usados por todos os aplicativos." />
      <div className="gs-grid">
        <form
          className="gs-card gs-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setSaved(null);
            const input = {
              name: String(f.get('name')),
              legal_name: String(f.get('legal_name')),
              document: String(f.get('document')),
              phone: String(f.get('phone')),
              email: String(f.get('email')),
              address: {
                street: String(f.get('street')),
                number: String(f.get('number')),
                neighborhood: String(f.get('neighborhood')),
                city: String(f.get('city')),
                state: String(f.get('state')),
                zip: String(f.get('zip')),
              },
              logo_path: logo,
              timezone: String(f.get('timezone')),
              business_day_start_hour: Number(f.get('day_start')),
            };
            void info.run(() => saveTenantInfo(tenantId, input), {
              onSuccess: () => setSaved('Informações salvas.'),
              approval: { kind: 'tenant.info', summary: 'Alterar dados do restaurante', payload: input },
            });
          }}
        >
          <h2 className="gs-h2">Identificação</h2>
          <div className="gs-row">
            {logo ? <img className="gs-thumb" src={mediaUrl(logo) ?? ''} alt="Logo atual" /> : <span className="gs-thumb" aria-hidden="true" />}
            {canEdit ? (
              <label className="gs-btn gs-btn--small">
                Enviar logo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && void uploadLogo(e.target.files[0])}
                />
              </label>
            ) : null}
            {uploadError ? <p className="gs-msg gs-msg--error">{uploadError}</p> : null}
          </div>
          <fieldset disabled={!canEdit} style={{ border: 'none', padding: 0, margin: 0 }} className="gs-form">
            <div className="gs-form-grid">
              <label className="gs-field">
                Nome do restaurante
                <input name="name" defaultValue={String(tenant.name ?? '')} required />
              </label>
              <label className="gs-field">
                Razão social
                <input name="legal_name" defaultValue={String(tenant.legal_name ?? '')} />
              </label>
              <label className="gs-field">
                CNPJ/CPF
                <input name="document" defaultValue={String(tenant.document ?? '')} />
              </label>
              <label className="gs-field">
                Telefone
                <input name="phone" defaultValue={String(tenant.phone ?? '')} inputMode="tel" />
              </label>
              <label className="gs-field">
                E-mail
                <input name="email" type="email" defaultValue={String(tenant.email ?? '')} />
              </label>
            </div>
            <h2 className="gs-h2">Endereço</h2>
            <div className="gs-form-grid">
              <label className="gs-field">
                Rua
                <input name="street" defaultValue={tenant.address.street ?? ''} />
              </label>
              <label className="gs-field">
                Número
                <input name="number" defaultValue={tenant.address.number ?? ''} />
              </label>
              <label className="gs-field">
                Bairro
                <input name="neighborhood" defaultValue={tenant.address.neighborhood ?? ''} />
              </label>
              <label className="gs-field">
                Cidade
                <input name="city" defaultValue={tenant.address.city ?? ''} />
              </label>
              <label className="gs-field">
                UF
                <input name="state" maxLength={2} defaultValue={tenant.address.state ?? ''} />
              </label>
              <label className="gs-field">
                CEP
                <input name="zip" defaultValue={tenant.address.zip ?? ''} inputMode="numeric" />
              </label>
            </div>
            <h2 className="gs-h2">Dia operacional</h2>
            <div className="gs-form-grid">
              <label className="gs-field">
                Fuso horário
                <select name="timezone" defaultValue={String(tenant.timezone)}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace('America/', '').replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="gs-field">
                Virada do dia operacional
                <select name="day_start" defaultValue={String(tenant.business_day_start_hour)}>
                  {Array.from({ length: 13 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <small>Vendas da madrugada contam para o dia anterior até este horário.</small>
              </label>
            </div>
          </fieldset>
          {info.error ? <p className="gs-msg gs-msg--error">{info.error.message}</p> : null}
          {saved ? <p className="gs-msg gs-msg--ok">{saved}</p> : null}
          {canEdit ? (
            <button type="submit" className="gs-btn gs-btn--primary" disabled={info.pending}>
              {info.pending ? 'Salvando…' : 'Salvar informações'}
            </button>
          ) : (
            <p className="gs-meta">Somente leitura: você não tem permissão para alterar estes dados.</p>
          )}
        </form>

        <div className="gs-form" style={{ alignContent: 'start' }}>
          <section className="gs-card" id="horarios" aria-labelledby="h-title">
            <h2 id="h-title" className="gs-h2">
              Horários de funcionamento
            </h2>
            {rows.length === 0 ? <p className="gs-meta">Sem horários: cardápio e delivery ficam disponíveis sempre que ativos.</p> : null}
            <ul className="gs-list">
              {rows.map((row, i) => (
                <li key={i}>
                  <select
                    className="gs-input"
                    style={{ width: 130 }}
                    aria-label="Dia"
                    value={row.weekday}
                    disabled={!canEditHours}
                    onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, weekday: Number(e.target.value) } : r)))}
                  >
                    {WEEKDAYS.map((d, w) => (
                      <option key={d} value={w}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <input
                    className="gs-input"
                    style={{ width: 110 }}
                    type="time"
                    aria-label="Abre"
                    value={row.opens}
                    disabled={!canEditHours}
                    onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, opens: e.target.value } : r)))}
                  />
                  <input
                    className="gs-input"
                    style={{ width: 110 }}
                    type="time"
                    aria-label="Fecha"
                    value={row.closes}
                    disabled={!canEditHours}
                    onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, closes: e.target.value } : r)))}
                  />
                  {canEditHours ? (
                    <button type="button" className="gs-btn gs-btn--small gs-btn--danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                      Remover
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {canEditHours ? (
              <div className="gs-row">
                <button
                  type="button"
                  className="gs-btn gs-btn--small"
                  onClick={() => setRows([...rows, { weekday: rows.length % 7, opens: '18:00', closes: '23:00' }])}
                >
                  Adicionar horário
                </button>
                <button
                  type="button"
                  className="gs-btn gs-btn--small gs-btn--primary"
                  disabled={hoursAction.pending}
                  onClick={() =>
                    void hoursAction.run(() => saveBusinessHours(tenantId, rows), {
                      approval: { kind: 'hours.set', summary: 'Alterar horários de funcionamento', payload: { hours: rows } },
                    })
                  }
                >
                  Salvar horários
                </button>
              </div>
            ) : null}
            {hoursAction.error ? <p className="gs-msg gs-msg--error">{hoursAction.error.message}</p> : null}
          </section>
          <section className="gs-card" aria-labelledby="links">
            <h2 id="links" className="gs-h2">
              Endereços do restaurante
            </h2>
            <ul className="gs-list">
              {publicLinks.map((l) => (
                <li key={l.label}>
                  <span>{l.label}</span>
                  <a href={l.url} target="_blank" rel="noreferrer" className="gs-meta" style={{ overflowWrap: 'anywhere' }}>
                    {l.url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      <ApprovalDialog tenantId={tenantId} approval={info.approval} onClose={info.clearApproval} />
      <ApprovalDialog tenantId={tenantId} approval={hoursAction.approval} onClose={hoursAction.clearApproval} />
    </>
  );
}
