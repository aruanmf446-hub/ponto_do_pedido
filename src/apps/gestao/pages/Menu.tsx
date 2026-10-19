'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCents, parseCents } from '@/core/money';
import { browserSupabase } from '@/core/supabase/browser';
import { ProductImage } from '@/core/ui/ProductImage';
import { ApprovalDialog } from '@/core/ui/ApprovalDialog';
import { Dialog } from '@/core/ui/Dialog';
import { useTenant } from '@/core/ui/TenantProvider';
import { useAction } from '@/core/ui/useAction';
import { deleteCategory, deleteProduct, saveCategory, saveProduct, type ProductInput } from '@/apps/gestao/actions';
import type { Category, Product } from '@/apps/gestao/queries';
import { Badge, Empty, PageHead } from '@/apps/gestao/ui';

const CHANNELS = [
  ['salao', 'Atendimento (salão)'],
  ['cardapio', 'Cardápio por QR Code'],
  ['delivery', 'Delivery'],
] as const;

export function MenuPage({ categories, products, sectors }: { categories: Category[]; products: Product[]; sectors: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [catEdit, setCatEdit] = useState<Category | 'new' | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const shown = products.filter((p) => filter === 'all' || p.category_id === filter);

  return (
    <>
      <PageHead
        title="Produtos e categorias"
        subtitle="Fotos, descrições e preços. Os mesmos registros alimentam Atendimento, Cardápio Digital e Delivery."
        actions={
          <>
            {categories.length > 1 ? <button type="button" className="gs-btn" onClick={() => setOrganizing(true)}>Organizar categorias</button> : null}
            <button type="button" className="gs-btn" onClick={() => setCatEdit('new')}>
              Nova categoria
            </button>
            <button type="button" className="gs-btn gs-btn--primary" onClick={() => setEditing('new')} disabled={categories.length === 0}>
              Novo produto
            </button>
          </>
        }
      />
      <div className="gs-tabs" role="group" aria-label="Categorias">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          Todas ({products.length})
        </button>
        {categories.map((c) => (
          <button key={c.id} type="button" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)} onDoubleClick={() => setCatEdit(c)}>
            {c.name} ({products.filter((p) => p.category_id === c.id).length})
          </button>
        ))}
      </div>
      {filter !== 'all' ? (
        <p className="gs-meta">
          <button type="button" className="gs-btn gs-btn--small" onClick={() => setCatEdit(categories.find((c) => c.id === filter) ?? null)}>
            Editar categoria
          </button>
        </p>
      ) : null}
      {categories.length === 0 ? <Empty>Crie uma categoria para começar o cardápio.</Empty> : null}
      <div className="gs-grid">
        {shown.map((p) => (
          <article key={p.id} className="gs-card gs-product">
            <span className="gs-thumb">
              <ProductImage name={p.name} path={p.image_path} category={categories.find((c) => c.id === p.category_id)?.name} />
            </span>
            <div>
              <h2 className="gs-h2">{p.name}</h2>
              <p className="gs-meta" style={{ margin: '2px 0' }}>
                {p.description || 'Sem descrição'}
              </p>
              <div className="gs-row">
                <strong>{formatCents(p.price_cents)}</strong>
                {!p.available ? <Badge tone="warn">Indisponível</Badge> : null}
              </div>
            </div>
            <button type="button" className="gs-btn gs-btn--small" onClick={() => setEditing(p)}>
              Editar
            </button>
          </article>
        ))}
      </div>
      {editing ? (
        <ProductEditor
          product={editing === 'new' ? null : editing}
          categories={categories}
          sectors={sectors}
          defaultCategory={filter !== 'all' ? filter : (categories[0]?.id ?? null)}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {catEdit ? <CategoryEditor category={catEdit === 'new' ? null : catEdit} nextPosition={categories.reduce((max, item) => Math.max(max, item.position), 0) + 1} onClose={() => setCatEdit(null)} /> : null}
      {organizing ? <CategoryOrder categories={categories} onClose={() => setOrganizing(false)} /> : null}
    </>
  );
}

function ProductEditor({
  product,
  categories,
  sectors,
  defaultCategory,
  onClose,
}: {
  product: Product | null;
  categories: Category[];
  sectors: { id: string; name: string }[];
  defaultCategory: string | null;
  onClose: () => void;
}) {
  const { tenantId } = useTenant();
  const action = useAction();
  const [image, setImage] = useState<string | null>(product?.image_path ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploadError(null);
    if (file.size > 5 * 1024 * 1024) return setUploadError('A foto deve ter até 5 MB.');
    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${tenantId}/products/${crypto.randomUUID()}.${ext}`;
    const { error } = await browserSupabase().storage.from('tenant-media').upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) return setUploadError('Falha ao enviar a foto.');
    setImage(path);
  };

  return (
    <Dialog open onClose={onClose} title={product ? product.name : 'Novo produto'}>
      <form
        className="gs-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const price = parseCents(String(f.get('price')));
          if (price == null) return;
          const input: ProductInput = {
            id: product?.id ?? null,
            category_id: String(f.get('category')) || null,
            name: String(f.get('name')),
            description: String(f.get('description')),
            price_cents: price,
            image_path: image,
            available: f.get('available') === 'on',
            active: true,
            channels: f.getAll('channels').map(String),
            prep_sector_id: String(f.get('prep')) || null,
            position: product?.position ?? 0,
          };
          void action.run(() => saveProduct(tenantId, input), {
            onSuccess: onClose,
            approval: {
              kind: 'product.save',
              summary: `${product ? 'Alterar' : 'Cadastrar'} produto ${input.name} (${formatCents(input.price_cents)})`,
              payload: { ...input, id: input.id ?? '', category_id: input.category_id ?? '', prep_sector_id: input.prep_sector_id ?? '' },
            },
          });
        }}
      >
        <div className="gs-row">
          <span className="gs-thumb">
            <ProductImage name={product?.name || 'Produto'} path={image} />
          </span>
          <label className="gs-btn gs-btn--small">
            {uploading ? 'Enviando…' : image ? 'Trocar foto' : 'Enviar foto'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          </label>
          {uploadError ? <p className="gs-msg gs-msg--error">{uploadError}</p> : null}
        </div>
        <div className="gs-form-grid">
          <label className="gs-field">
            Nome
            <input name="name" defaultValue={product?.name ?? ''} required maxLength={80} />
          </label>
          <label className="gs-field">
            Preço (R$)
            <input name="price" defaultValue={product ? (product.price_cents / 100).toFixed(2).replace('.', ',') : ''} inputMode="decimal" required />
          </label>
          <label className="gs-field">
            Categoria
            <select name="category" defaultValue={product?.category_id ?? defaultCategory ?? ''}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="gs-field">
            Setor de preparo
            <select name="prep" defaultValue={product?.prep_sector_id ?? ''}>
              <option value="">Cozinha</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="gs-field">
          Descrição
          <textarea name="description" rows={3} defaultValue={product?.description ?? ''} />
        </label>
        <fieldset className="gs-row" style={{ border: 'none', padding: 0 }}>
          <legend className="gs-meta">Disponível em</legend>
          {CHANNELS.map(([k, label]) => (
            <label key={k} className="gs-check">
              <input type="checkbox" name="channels" value={k} defaultChecked={product ? product.channels.includes(k) : true} /> {label}
            </label>
          ))}
        </fieldset>
        <label className="gs-check">
          <input type="checkbox" name="available" defaultChecked={product?.available ?? true} /> Disponível para pedidos agora
        </label>
        {action.error ? <p className="gs-msg gs-msg--error">{action.error.message}</p> : null}
        <div className="gs-row">
          <button type="submit" className="gs-btn gs-btn--primary" disabled={action.pending || uploading}>
            Salvar produto
          </button>
          {product ? (
            <button
              type="button"
              className="gs-btn gs-btn--danger"
              disabled={action.pending}
              onClick={() =>
                void action.run(() => deleteProduct(tenantId, product.id), {
                  onSuccess: onClose,
                  approval: { kind: 'product.delete', summary: `Excluir produto ${product.name}`, payload: { id: product.id } },
                })
              }
            >
              Excluir
            </button>
          ) : null}
        </div>
      </form>
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </Dialog>
  );
}

function CategoryEditor({ category, nextPosition, onClose }: { category: Category | null; nextPosition: number; onClose: () => void }) {
  const { tenantId } = useTenant();
  const action = useAction();
  return (
    <Dialog open onClose={onClose} title={category ? `Categoria ${category.name}` : 'Nova categoria'}>
      <form
        className="gs-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const input = {
            id: category?.id ?? null,
            name: String(f.get('name')),
            description: String(f.get('description')),
            position: category?.position ?? nextPosition,
            active: f.get('active') === 'on',
          };
          void action.run(() => saveCategory(tenantId, input), {
            onSuccess: onClose,
            approval: { kind: 'category.save', summary: `Salvar categoria ${input.name}`, payload: { ...input, id: input.id ?? '' } },
          });
        }}
      >
        <label className="gs-field">
          Nome
          <input name="name" defaultValue={category?.name ?? ''} required />
        </label>
        <label className="gs-field">
          Descrição
          <input name="description" defaultValue={category?.description ?? ''} />
        </label>
        <label className="gs-check">
          <input type="checkbox" name="active" defaultChecked={category?.active ?? true} /> Ativa
        </label>
        {action.error ? <p className="gs-msg gs-msg--error">{action.error.message}</p> : null}
        <div className="gs-row">
          <button type="submit" className="gs-btn gs-btn--primary" disabled={action.pending}>
            Salvar
          </button>
          {category ? (
            <button
              type="button"
              className="gs-btn gs-btn--danger"
              onClick={() =>
                void action.run(() => deleteCategory(tenantId, category.id), {
                  onSuccess: onClose,
                  approval: { kind: 'category.delete', summary: `Excluir categoria ${category.name}`, payload: { id: category.id } },
                })
              }
            >
              Excluir
            </button>
          ) : null}
        </div>
      </form>
      <ApprovalDialog tenantId={tenantId} approval={action.approval} onClose={action.clearApproval} />
    </Dialog>
  );
}

/** Organiza categorias por arraste, sem exigir números do restaurante. */
function CategoryOrder({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const { tenantId } = useTenant();
  const router = useRouter();
  const [items, setItems] = useState(() => [...categories]);
  const [dragged, setDragged] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const move = (from: string, target: string) => setItems((prev) => {
    const source = prev.findIndex((item) => item.id === from);
    const destination = prev.findIndex((item) => item.id === target);
    if (source < 0 || destination < 0 || source === destination) return prev;
    const next = [...prev];
    next.splice(destination, 0, ...next.splice(source, 1));
    return next;
  });
  async function save() {
    setSaving(true);
    setError('');
    try {
      // Reaproveita a RPC existente: mantém todas as validações de permissão.
      for (let i = 0; i < items.length; i++) {
        const category = items[i];
        if (!category || category.position === i + 1) continue;
        const result = await saveCategory(tenantId, {
          id: category.id, name: category.name, description: category.description,
          position: i + 1, active: category.active,
        });
        if (!result.ok) throw new Error(result.message);
      }
      router.refresh();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a ordem.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onClose={onClose} title="Organizar categorias">
      <div className="gs-form">
        <p className="gs-meta">Arraste as categorias para definir a ordem de exibição no cardápio. No celular, use as setas.</p>
        <ol style={{ listStyle: 'none', display: 'grid', gap: 8, margin: 0, padding: 0 }}>
          {items.map((category, index) => (
            <li key={category.id} draggable={!saving}
              onDragStart={(event) => { setDragged(category.id); event.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); if (dragged) move(dragged, category.id); setDragged(null); }}
              onDragEnd={() => setDragged(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--gs-line)', background: 'var(--gs-surface-2)', borderRadius: 10, padding: '10px 12px', cursor: 'grab', opacity: dragged === category.id ? 0.6 : 1 }}
            >
              <span aria-hidden="true" style={{ color: 'var(--gs-muted)' }}>⠿</span>
              <strong style={{ flex: 1 }}>{category.name}</strong>
              <button type="button" className="gs-btn gs-btn--small" aria-label={`Subir ${category.name}`} disabled={saving || index === 0} onClick={() => { const previous = items[index - 1]; if (previous) move(category.id, previous.id); }}>↑</button>
              <button type="button" className="gs-btn gs-btn--small" aria-label={`Descer ${category.name}`} disabled={saving || index === items.length - 1} onClick={() => { const next = items[index + 1]; if (next) move(category.id, next.id); }}>↓</button>
            </li>
          ))}
        </ol>
        {error ? <p className="gs-msg gs-msg--error" role="alert">{error}</p> : null}
        <div className="gs-row">
          <button type="button" className="gs-btn gs-btn--primary" disabled={saving} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar ordem'}</button>
          <button type="button" className="gs-btn" disabled={saving} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Dialog>
  );
}
