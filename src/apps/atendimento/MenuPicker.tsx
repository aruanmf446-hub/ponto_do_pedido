'use client';

import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatCents } from '@/core/money';
import { foodIcon, Icon } from '@/core/ui/Icon';
import { ProductImage } from '@/core/ui/ProductImage';
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
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return products.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    return products.filter((p) => !category || p.category_id === category);
  }, [products, category, query]);

  const pick = (p: MenuProduct) => p.available && onPick(p);
  const image = (p: MenuProduct) => <ProductImage name={p.name} path={p.image_path} category={p.category_id ? categoryName.get(p.category_id) : null} />;

  const cats = (
    <div className={`at-cats at-cats--${variant}`} role="tablist" aria-label="Categorias">
      {categories.map((c) => (
        <button key={c.id} type="button" role="tab" aria-selected={c.id === category && !query} onClick={() => (setCategory(c.id), setQuery(''))}>
          <span className="at-cat-icon">
            <Icon name={foodIcon(c.name)} size={variant === 'grid' ? 22 : 16} />
          </span>
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  );
  const search = (
    <label className="at-search">
      <Search size={16} aria-hidden="true" />
      <span className="sr-only">Buscar produto</span>
      <input type="search" placeholder="Buscar no cardápio…" value={query} onChange={(e) => setQuery(e.target.value)} />
    </label>
  );
  const card = (p: MenuProduct, extra = '') => (
    <button key={p.id} type="button" className={`at-product ${extra}`} disabled={!p.available} onClick={() => pick(p)}>
      <span className="at-product-photo">{image(p)}</span>
      <span className="at-product-body">
        <span className="at-product-name">{p.name}</span>
        {p.description ? <span className="at-product-desc">{p.description}</span> : null}
        <span className="at-product-foot">
          <span className="at-product-price">{p.available ? formatCents(p.price_cents) : 'Indisponível'}</span>
          {p.available ? (
            <span className="at-product-add" aria-hidden="true">
              <Plus size={16} />
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );

  if (variant === 'grid') {
    return (
      <div className="at-picker at-picker--grid">
        {cats}
        <div className="at-picker-body">
          <div className="at-picker-head">
            <h2>{query ? 'Resultados' : (categoryName.get(category) ?? 'Cardápio')}</h2>
            {search}
          </div>
          <div className="at-products">{filtered.map((p) => card(p))}</div>
        </div>
      </div>
    );
  }

  if (variant === 'strip') {
    return (
      <div className="at-picker at-picker--strip">
        <div className="at-row at-spread">
          {cats}
          {search}
        </div>
        <div className="at-strip">{filtered.map((p) => card(p, 'at-product--strip'))}</div>
      </div>
    );
  }

  return (
    <div className={`at-picker at-picker--${variant}`}>
      {search}
      {cats}
      <ul className="at-product-rows" aria-label="Produtos">
        {filtered.map((p) => (
          <li key={p.id}>
            <button type="button" disabled={!p.available} onClick={() => pick(p)}>
              <span className="at-row-photo">{image(p)}</span>
              <span className="at-row-text">
                <strong>{p.name}</strong>
                {p.description ? <small>{p.description}</small> : null}
              </span>
              <span className="at-row-price">{p.available ? formatCents(p.price_cents) : 'Indisponível'}</span>
              {p.available ? (
                <span className="at-product-add" aria-hidden="true">
                  <Plus size={16} />
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
