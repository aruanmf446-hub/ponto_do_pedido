'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveUiPreference } from '@/core/actions';
import type { ColorScheme, InternalApp, VisualModel } from '@/core/apps';
import { Dialog } from '@/core/ui/Dialog';

export type ModelOption = { id: VisualModel; name: string; description: string };

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
  label = 'Aparência',
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
      <button type="button" className="pdp-model-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Modelo visual" className="pdp-model-dialog">
        <p className="pdp-model-hint">A escolha vale só para você, neste restaurante e neste aplicativo.</p>
        <ul className="pdp-model-list" role="list">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="pdp-model-option"
                data-model-option={option.id}
                aria-pressed={option.id === current}
                disabled={pending}
                onClick={() => save(option.id, scheme)}
              >
                <strong>{option.name}</strong>
                <span>{option.description}</span>
              </button>
            </li>
          ))}
        </ul>
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
