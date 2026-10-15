'use client';

import { useMemo, useState } from 'react';
import { formatCents } from '@/core/money';
import { mediaUrl } from '@/core/storage';
import type { MenuProduct } from '@/apps/atendimento/queries';

export type PickerVariant = 'grid' | 'list' | 'search' | 'strip';

/** Seleção ágil de produtos. A composição muda conforme o modelo visual. */
export function MenuPicker({
  categories,
  products,
  variant,
  onPick,
}: {
  categories: { id: string; name: string }[];
  products: MenuProduct[];
  variant: PickerVariant;
  onPick: (product: MenuProduct) => void;
}) {
  const [category, setCategory] = useState<string>(categories[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return products.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    if (variant === 'search') return [];
    return products.filter((p) => !category || p.category_id === category);
  }, [products, category, query, variant]);

  const pick = (p: MenuProduct) => p.available && onPick(p);
  const photo = (p: MenuProduct) =>
    p.image_path ? <img src={mediaUrl(p.image_path) ?? ''} alt="" loading="lazy" /> : <span className="at-photo-fallback" aria-hidden="true">{p.name.slice(0, 1)}</span>;

  const tabs = (
    <div className={`at-cats at-cats--${variant}`} role="tablist" aria-label="Categorias">
      {categories.map((c) => (
        <button key={c.id} type="button" role="tab" aria-selected={c.id === category && !query} onClick={() => (setCategory(c.id), setQuery(''))}>
          {c.name}
        </button>
      ))}
    </div>
  );
  const search = (
    <label className="at-search">
      <span className="sr-only">Buscar produto</span>
      <input type="search" placeholder="Buscar produto…" value={query} onChange={(e) => setQuery(e.target.value)} />
    </label>
  );

  if (variant === 'grid') {
    return (
      <div className="at-picker at-picker--grid">
        {tabs}
        <div className="at-picker-body">
          {search}
          <div className="at-products">
            {filtered.map((p) => (
              <button key={p.id} type="button" className="at-product" disabled={!p.available} onClick={() => pick(p)}>
                <span className="at-product-photo">{photo(p)}</span>
                <span className="at-product-name">{p.name}</span>
                <span className="at-product-price">{p.available ? formatCents(p.price_cents) : 'Indisponível'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'strip') {
    return (
      <div className="at-picker at-picker--strip">
        <div className="at-row at-spread">
          {tabs}
          {search}
        </div>
        <div className="at-strip">
          {filtered.map((p) => (
            <button key={p.id} type="button" className="at-product at-product--strip" disabled={!p.available} onClick={() => pick(p)}>
              <span className="at-product-photo">{photo(p)}</span>
              <span className="at-product-name">{p.name}</span>
              <span className="at-product-price">{p.available ? formatCents(p.price_cents) : 'Indisponível'}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`at-picker at-picker--${variant}`}>
      {search}
      {variant === 'list' ? tabs : null}
      <ul className="at-product-rows" aria-label="Produtos">
        {filtered.map((p) => (
          <li key={p.id}>
            <button type="button" disabled={!p.available} onClick={() => pick(p)}>
              <span>
                <strong>{p.name}</strong>
                {p.description ? <small>{p.description}</small> : null}
              </span>
              <span>{p.available ? formatCents(p.price_cents) : 'Indisponível'}</span>
            </button>
          </li>
        ))}
        {variant === 'search' && !query ? <li className="at-meta">Digite para buscar no cardápio.</li> : null}
      </ul>
      {variant === 'search' ? (
        <div className="at-quick" aria-label="Atalhos">
          {products.filter((p) => p.available).slice(0, 8).map((p) => (
            <button key={p.id} type="button" onClick={() => pick(p)}>
              + {p.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
