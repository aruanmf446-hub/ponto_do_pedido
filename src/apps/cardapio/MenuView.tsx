'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { formatCents } from '@/core/money';
import { mediaUrl } from '@/core/storage';
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
    setKey(value);
  }, [qr]);
  return key;
}

export function CategoryList({ categories, onAdd }: { categories: MenuCategory[]; onAdd?: (p: MenuCategory['products'][number]) => void }) {
  return (
    <>
      <nav className="cd-cats" aria-label="Categorias">
        {categories.map((c) => (
          <a key={c.id} href={`#cat-${c.id}`}>
            {c.name}
          </a>
        ))}
      </nav>
      {categories.map((c) => (
        <section key={c.id} id={`cat-${c.id}`} className="cd-category" aria-labelledby={`h-${c.id}`}>
          <h2 id={`h-${c.id}`}>{c.name}</h2>
          {c.description ? <p className="cd-desc">{c.description}</p> : null}
          <ul className="cd-products">
            {c.products.map((p) => (
              <li key={p.id} className="cd-product" data-available={p.available}>
                {p.image_path ? <img src={mediaUrl(p.image_path) ?? ''} alt="" loading="lazy" /> : <span className="cd-photo" aria-hidden="true" />}
                <div>
                  <h3>{p.name}</h3>
                  {p.description ? <p>{p.description}</p> : null}
                  <span className="cd-price">{p.available ? formatCents(p.price_cents) : 'Indisponível no momento'}</span>
                </div>
                {onAdd && p.available ? (
                  <button type="button" className="cd-add" onClick={() => onAdd(p)} aria-label={`Adicionar ${p.name}`}>
                    +
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function TableMenuView({ qr, initial }: { qr: string; initial: TableMenu }) {
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

  return (
    <div className="cd-layout">
      <div className="cd-hero">
        <p className="cd-eyebrow">Mesa {menu.table?.label}</p>
        <h1>Bem-vindo ao nosso cardápio</h1>
        <p className="cd-desc">
          {canOrder
            ? menu.confirmation === 'atendente'
              ? 'Escolha seus pratos e envie o pedido. Um atendente confirma antes de seguir para a cozinha.'
              : 'Escolha seus pratos e envie o pedido direto para a cozinha.'
            : 'Consulte o cardápio. Para pedir, chame um atendente.'}
          {menu.service_fee_percent ? ` Taxa de serviço de ${Number(menu.service_fee_percent)}%.` : ''}
        </p>
        {!menu.open_now ? <p className="cd-warn">O restaurante está fechado no momento.</p> : null}
      </div>

      <div className="cd-columns">
        <div>
          <CategoryList categories={menu.categories ?? []} onAdd={canOrder && menu.open_now ? add : undefined} />
        </div>
        {canOrder || myOrders.length ? (
          <aside className="cd-cart" aria-label="Seu pedido">
            {canOrder ? (
              <section>
                <h2>Seu pedido</h2>
                {cart.length === 0 ? <p className="cd-desc">Toque em + para adicionar.</p> : null}
                <ul className="cd-cart-items">
                  {cart.map((i) => (
                    <li key={i.product_id}>
                      <div className="cd-row">
                        <strong>{i.name}</strong>
                        <span>{formatCents(i.price_cents * i.quantity)}</span>
                      </div>
                      <div className="cd-row">
                        <div className="cd-qty">
                          <button type="button" aria-label="Diminuir" onClick={() => setCart(cart.flatMap((x) => (x === i ? (x.quantity > 1 ? [{ ...x, quantity: x.quantity - 1 }] : []) : [x])))}>
                            −
                          </button>
                          <span>{i.quantity}</span>
                          <button type="button" aria-label="Aumentar" onClick={() => setCart(cart.map((x) => (x === i ? { ...x, quantity: Math.min(20, x.quantity + 1) } : x)))}>
                            +
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
        ) : null}
      </div>
    </div>
  );
}
