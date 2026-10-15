'use client';

import { LayoutTemplate } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveUiPreference } from '@/core/actions';
import type { ColorScheme, InternalApp, VisualModel } from '@/core/apps';
import { Dialog } from '@/core/ui/Dialog';
import { TemplateGallery, type TemplateOption } from '@/core/ui/TemplateGallery';

export type ModelOption = TemplateOption;

/**
 * Escolha do modelo visual do aplicativo (salvo por usuário, restaurante e
 * aplicativo). A troca não altera dados, permissões nem estados de negócio.
 */
export function ModelPicker({
  tenantId,
  app,
  current,
  scheme,
  options,
}: {
  tenantId: string;
  app: InternalApp;
  current: VisualModel;
  scheme: ColorScheme;
  options: ModelOption[];
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const index = Math.max(0, options.findIndex((o) => o.id === current));
  const active = options[index];

  const save = (model: VisualModel, nextScheme: ColorScheme) =>
    start(async () => {
      const result = await saveUiPreference(tenantId, app, model, nextScheme);
      if (!result.ok) setError(result.message);
      else {
        setOpen(false);
        router.refresh();
      }
    });

  return (
    <>
      <button type="button" className="pdp-model-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog" title="Trocar o modelo visual">
        <LayoutTemplate size={16} aria-hidden="true" />
        <span className="pdp-model-trigger-label">
          Modelo {index + 1}/{options.length}
          {active ? <span className="pdp-model-trigger-name"> · {active.name}</span> : null}
        </span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Escolha o modelo deste aplicativo" className="pdp-model-dialog">
        <p className="pdp-model-hint">
          {options.length} modelos com organização e visual próprios. A escolha vale só para você, neste restaurante e neste aplicativo.
        </p>
        <TemplateGallery options={options} current={current} disabled={pending} onSelect={(id) => save(id, scheme)} />
        <fieldset className="pdp-scheme">
          <legend>Tema</legend>
          {(['system', 'light', 'dark'] as const).map((value) => (
            <label key={value}>
              <input type="radio" name="scheme" checked={scheme === value} disabled={pending} onChange={() => save(current, value)} />
              {value === 'system' ? 'Automático' : value === 'light' ? 'Claro' : 'Escuro'}
            </label>
          ))}
        </fieldset>
        {error ? (
          <p role="alert" className="pdp-msg pdp-msg--error">
            {error}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
