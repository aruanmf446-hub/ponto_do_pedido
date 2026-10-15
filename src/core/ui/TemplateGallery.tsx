'use client';

import { Check } from 'lucide-react';
import type { VisualModel } from '@/core/apps';
import { ModelThumb, type ThumbSpec } from '@/core/ui/ModelThumb';

export type TemplateOption = { id: VisualModel; name: string; description: string; thumb: ThumbSpec };

/** Galeria de modelos com miniatura, número e descrição (estilizada por cada app). */
export function TemplateGallery({
  options,
  current,
  disabled,
  onSelect,
}: {
  options: TemplateOption[];
  current: VisualModel;
  disabled?: boolean;
  onSelect: (id: VisualModel) => void;
}) {
  return (
    <ul className="pdp-gallery" role="list">
      {options.map((option, index) => {
        const active = option.id === current;
        return (
          <li key={option.id}>
            <button type="button" className="pdp-gallery-card" data-model-option={option.id} aria-pressed={active} disabled={disabled} onClick={() => onSelect(option.id)}>
              <span className="pdp-gallery-preview">
                <ModelThumb spec={option.thumb} />
                {active ? (
                  <span className="pdp-gallery-active">
                    <Check size={14} aria-hidden="true" /> Em uso
                  </span>
                ) : null}
              </span>
              <span className="pdp-gallery-text">
                <span className="pdp-gallery-index">Modelo {index + 1}</span>
                <strong>{option.name}</strong>
                <span className="pdp-gallery-desc">{option.description}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
