'use client';

import { Minus, Plus, QrCode, Search } from 'lucide-react';
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import type { VisualModel } from '@/core/apps';
import { formatCents } from '@/core/money';
import { FoodArt } from '@/core/ui/FoodArt';
import { foodIcon, Icon } from '@/core/ui/Icon';
import { ProductImage } from '@/core/ui/ProductImage';
import { placeTableOrder, refreshTableMenu, requestTableBill, type MenuCategory, type TableMenu } from '@/apps/cardapio/actions';

type CartItem = { product_id: string; name: string; price_cents: number; quantity: number; notes: string };

const ORDER_STATUS: Record<string, string> = {
  pending_confirmation: 'Aguardando confirmação do atendente',
  confirmed: 'Recebido pela cozinha',
  preparing: 'Em preparo',
  ready: 'Pronto',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  rejected: 'Não confirmado',
};

function randomKey() {
  return (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^a-zA-Z0-9]/g, '');
}

/** Chave do convidado por mesa: identifica apenas os pedidos deste dispositivo. */
function useGuestKey(qr: string | null) {
  const [key, setKey] = useState<string>('');
  useEffect(() => {
    if (!qr) return;
    const storageKey = `pdp-guest:${qr}`;
    let value = '';
    try {
      value = localStorage.getItem(storageKey) ?? '';
      if (!value) {
        value = randomKey();
        localStorage.setItem(storageKey, value);
      }
    } catch {
      value = randomKey();
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a chave do dispositivo só existe após a hidratação
    setKey(value);
  }, [qr]);
  return key;
}

type Product = MenuCategory['products'][number];

/** Abertura do cardápio; a composição muda com o modelo escolhido pelo restaurante. */
export function MenuHero({
  template,
  eyebrow,
  title,
  text,
  warn,
  categories,
}: {
  template: VisualModel;
  eyebrow: string;
  title: string;
  text?: string;
  warn?: string | null;
  categories: MenuCategory[];
}) {
  const featured = categories.flatMap((c) => c.products.map((p) => ({ ...p, category: c.name }))).filter((p) => p.available);
  return (
    <section className="cd-hero" data-template={template}>
      <div className="cd-hero-text">
        <p className="cd-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {text ? <p className="cd-desc">{text}</p> : null}
        {warn ? <p className="cd-warn">{warn}</p> : null}
        {template === 'm1' ? (
          <p className="cd-qr-note">
            <QrCode size={18} aria-hidden="true" /> Aponte a câmera para o QR Code da mesa e acompanhe tudo por aqui.
          </p>
        ) : null}
      </div>
      {template === 'm2' && featured.length ? (
        <div className="cd-hero-art" aria-hidden="true">
          {featured.slice(0, 3).map((p) => (
            <span key={p.id} className="cd-hero-plate">
              <ProductImage name={p.name} path={p.image_path} category={p.category} />
            </span>
          ))}
        </div>
      ) : null}
      {template === 'm3' && featured[0] ? (
        <div className="cd-feature">
          <span className="cd-feature-photo">
            <ProductImage name={featured[0].name} path={featured[0].image_path} category={featured[0].category} />
          </span>
          <span className="cd-feature-text">
            <small>Sugestão da casa</small>
            <strong>{featured[0].name}</strong>
            {featured[0].description ? <span>{featured[0].description}</span> : null}
            <b>{formatCents(featured[0].price_cents)}</b>
          </span>
        </div>
      ) : null}
    </section>
  );
}

/** Cardápio por categorias. A estrutura muda com o modelo: lista, vitrine, premium ou grade rápida. */
export function MenuBody({
  template,
  categories,
  hero,
  aside,
  onAdd,
}: {
  template: VisualModel;
  categories: MenuCategory[];
  hero: ReactNode;
  aside?: ReactNode;
  onAdd?: (p: Product) => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q
    ? categories.map((c) => ({ ...c, products: c.products.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(q)) })).filter((c) => c.products.length)
    : categories;
  const side = template === 'm3' || template === 'm4';

  const nav = (
    <nav className="cd-cats" aria-label="Categorias">
      {categories.map((c) => (
        <a key={c.id} href={`#cat-${c.id}`}>
          <span className="cd-cat-icon">
            <Icon name={foodIcon(c.name)} size={template === 'm2' ? 22 : 17} />
          </span>
          <span>{c.name}</span>
        </a>
      ))}
    </nav>
  );
  const search = (
    <label className="cd-search">
      <Search size={16} aria-hidden="true" />
      <span className="sr-only">Buscar no cardápio</span>
      <input type="search" placeholder="Buscar prato ou bebida" value={query} onChange={(e) => setQuery(e.target.value)} />
    </label>
  );
  const product = (p: Product, category: string) => (
    <li key={p.id} className="cd-product" data-available={p.available}>
      <span className="cd-photo">
        <ProductImage name={p.name} path={p.image_path} category={category} />
      </span>
      <div className="cd-product-body">
        <h3>{p.name}</h3>
        {p.description ? <p>{p.description}</p> : null}
        <span className="cd-price">{p.available ? formatCents(p.price_cents) : 'Indisponível no momento'}</span>
      </div>
      {onAdd && p.available ? (
        <button type="button" className="cd-add" onClick={() => onAdd(p)} aria-label={`Adicionar ${p.name}`}>
          <Plus size={18} aria-hidden="true" />
        </button>
      ) : null}
    </li>
  );
  const sections = (
    <div className="cd-sections">
      {shown.map((c) => (
        <section key={c.id} id={`cat-${c.id}`} className="cd-category" aria-labelledby={`h-${c.id}`}>
          <h2 id={`h-${c.id}`}>
            <span className="cd-cat-icon">
              <Icon name={foodIcon(c.name)} size={18} />
            </span>
            {c.name}
          </h2>
          {c.description ? <p className="cd-desc">{c.description}</p> : null}
          <ul className="cd-products">{c.products.map((p) => product(p, c.name))}</ul>
        </section>
      ))}
      {shown.length === 0 ? <p className="cd-desc">Nada encontrado para “{query}”.</p> : null}
    </div>
  );

  return (
    <div className="cd-menu" data-template={template} data-has-aside={!!aside}>
      {side ? <aside className="cd-rail">{nav}</aside> : null}
      <div className="cd-content">
        {hero}
        <div className="cd-toolbar">
          {side ? null : nav}
          {search}
        </div>
        {sections}
      </div>
      {aside ? <div className="cd-aside">{aside}</div> : null}
    </div>
  );
}

export function TableMenuView({ qr, initial, template }: { qr: string; initial: TableMenu; template: VisualModel }) {
  const guest = useGuestKey(qr);
  const [menu, setMenu] = useState<TableMenu>(initial);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [orderKey, setOrderKey] = useState(randomKey);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const canOrder = menu.mode === 'cliente' || menu.mode === 'ambos';
  const total = cart.reduce((s, i) => s + i.price_cents * i.quantity, 0);
  const myOrders = useMemo(() => menu.my_orders ?? [], [menu.my_orders]);

  // Atualiza o acompanhamento dos próprios pedidos
  useEffect(() => {
    if (!guest) return;
    let active = true;
    const load = async () => {
      const r = await refreshTableMenu(qr, guest);
      if (active && r.ok) setMenu(r.data);
    };
    void load();
    const t = setInterval(load, 20_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [qr, guest]);

  const add = (p: MenuCategory['products'][number]) => {
    setMessage(null);
    setCart((c) => {
      const found = c.find((i) => i.product_id === p.id);
      if (found) return c.map((i) => (i === found ? { ...i, quantity: Math.min(20, i.quantity + 1) } : i));
      return [...c, { product_id: p.id, name: p.name, price_cents: p.price_cents, quantity: 1, notes: '' }];
    });
  };

  const send = () =>
    start(async () => {
      const r = await placeTableOrder(qr, guest, cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity, notes: i.notes })), notes, orderKey);
      if (!r.ok) return setMessage({ kind: 'error', text: r.message });
      setCart([]);
      setNotes('');
      setOrderKey(randomKey());
      setMessage({
        kind: 'ok',
        text: r.data.status === 'pending_confirmation' ? `Pedido nº ${r.data.order_number} enviado. O atendente vai confirmar.` : `Pedido nº ${r.data.order_number} enviado para a cozinha.`,
      });
      const fresh = await refreshTableMenu(qr, guest);
      if (fresh.ok) setMenu(fresh.data);
    });

  const bill = () =>
    start(async () => {
      const r = await requestTableBill(qr, guest);
      setMessage(r.ok ? { kind: 'ok', text: 'Conta solicitada. Um atendente vai até a sua mesa.' } : { kind: 'error', text: r.message });
      if (r.ok) setMenu((m) => ({ ...m, bill_requested: true }));
    });

  const hero = (
    <MenuHero
      template={template}
      eyebrow={`Mesa ${menu.table?.label ?? ''}`}
      title={template === 'm2' ? 'Peça sem esperar' : 'Bem-vindo ao nosso cardápio'}
      text={`${
        canOrder
          ? menu.confirmation === 'atendente'
            ? 'Escolha seus pratos e envie o pedido. Um atendente confirma antes de seguir para a cozinha.'
            : 'Escolha seus pratos e envie o pedido direto para a cozinha.'
          : 'Consulte o cardápio. Para pedir, chame um atendente.'
      }${menu.service_fee_percent ? ` Taxa de serviço de ${Number(menu.service_fee_percent)}%.` : ''}`}
      warn={!menu.open_now ? 'O restaurante está fechado no momento.' : null}
      categories={menu.categories ?? []}
    />
  );
  const aside =
    canOrder || myOrders.length ? (
          <aside className="cd-cart" aria-label="Seu pedido">
            {canOrder ? (
              <section>
                <h2>Seu pedido</h2>
                {cart.length === 0 ? <p className="cd-desc">Toque em + para adicionar.</p> : null}
                <ul className="cd-cart-items">
                  {cart.map((i) => (
                    <li key={i.product_id}>
                      <div className="cd-row">
                        <span className="cd-cart-thumb">
                          <FoodArt name={i.name} label="" />
                        </span>
                        <strong>{i.name}</strong>
                        <span>{formatCents(i.price_cents * i.quantity)}</span>
                      </div>
                      <div className="cd-row">
                        <div className="cd-qty">
                          <button type="button" aria-label="Diminuir" onClick={() => setCart(cart.flatMap((x) => (x === i ? (x.quantity > 1 ? [{ ...x, quantity: x.quantity - 1 }] : []) : [x])))}>
                            <Minus size={14} aria-hidden="true" />
                          </button>
                          <span>{i.quantity}</span>
                          <button type="button" aria-label="Aumentar" onClick={() => setCart(cart.map((x) => (x === i ? { ...x, quantity: Math.min(20, x.quantity + 1) } : x)))}>
                            <Plus size={14} aria-hidden="true" />
                          </button>
                        </div>
                        <input
                          aria-label={`Observação para ${i.name}`}
                          placeholder="Observação"
                          value={i.notes}
                          maxLength={200}
                          onChange={(e) => setCart(cart.map((x) => (x === i ? { ...x, notes: e.target.value } : x)))}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                {cart.length ? (
                  <>
                    <input className="cd-input" placeholder="Observação geral" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} />
                    <button type="button" className="cd-btn" disabled={pending || !guest} onClick={send}>
                      {pending ? 'Enviando…' : `Enviar pedido · ${formatCents(total)}`}
                    </button>
                  </>
                ) : null}
              </section>
            ) : null}
            {message ? (
              <p className={message.kind === 'ok' ? 'cd-ok' : 'cd-error'} role={message.kind === 'ok' ? 'status' : 'alert'}>
                {message.text}
              </p>
            ) : null}
            {myOrders.length ? (
              <section>
                <h2>Seus pedidos</h2>
                <ol className="cd-orders">
                  {myOrders.map((o) => (
                    <li key={o.id}>
                      <div className="cd-row">
                        <strong>Nº {o.number}</strong>
                        <span className="cd-status" data-status={o.status}>
                          {ORDER_STATUS[o.status] ?? o.status}
                        </span>
                      </div>
                      <small>{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</small>
                    </li>
                  ))}
                </ol>
                {menu.bill_requested ? (
                  <p className="cd-ok">Conta solicitada.</p>
                ) : (
                  <button type="button" className="cd-btn cd-btn--ghost" disabled={pending} onClick={bill}>
                    Pedir a conta
                  </button>
                )}
              </section>
            ) : null}
          </aside>
    ) : null;

  return <MenuBody template={template} categories={menu.categories ?? []} hero={hero} aside={aside} onAdd={canOrder && menu.open_now ? add : undefined} />;
}
