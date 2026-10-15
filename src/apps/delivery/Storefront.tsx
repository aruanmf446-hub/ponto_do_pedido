'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { formatCents, parseCents } from '@/core/money';
import { mediaUrl } from '@/core/storage';
import { placeDeliveryOrder, type DeliveryMenu } from '@/apps/delivery/actions';

type CartItem = { product_id: string; name: string; price_cents: number; quantity: number; notes: string };
type Step = 'contato' | 'produtos' | 'endereco' | 'revisao';

function key() {
  return (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^a-zA-Z0-9]/g, '');
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function Storefront({ slug, menu, base }: { slug: string; menu: DeliveryMenu; base: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('contato');
  const [contact, setContact] = useState({ name: '', whatsapp: '' });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [address, setAddress] = useState({ street: '', number: '', complement: '', neighborhood: '', reference: '' });
  const [zone, setZone] = useState(menu.zones?.[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState(menu.payment_methods?.[0]?.id ?? '');
  const [changeFor, setChangeFor] = useState('');
  const [orderKey] = useState(key);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [category, setCategory] = useState(menu.categories?.[0]?.id ?? '');

  // Lembra o contato no dispositivo (somente localmente)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pdp-delivery-contact') ?? 'null');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- dados locais só existem após a hidratação
      if (saved?.whatsapp) setContact(saved);
    } catch {}
  }, []);

  const zoneData = menu.zones?.find((z) => z.id === zone);
  const items = cart.reduce((s, i) => s + i.price_cents * i.quantity, 0);
  const fee = zoneData?.fee_cents ?? 0;
  const belowMin = zoneData ? items < zoneData.min_order_cents : false;
  const methodKind = menu.payment_methods?.find((m) => m.id === method)?.kind;
  const products = useMemo(() => menu.categories?.find((c) => c.id === category)?.products ?? [], [menu.categories, category]);

  const add = (p: { id: string; name: string; price_cents: number }) =>
    setCart((c) => {
      const f = c.find((i) => i.product_id === p.id);
      if (f) return c.map((i) => (i === f ? { ...i, quantity: Math.min(20, i.quantity + 1) } : i));
      return [...c, { product_id: p.id, name: p.name, price_cents: p.price_cents, quantity: 1, notes: '' }];
    });

  const steps: [Step, string][] = [
    ['contato', 'Contato'],
    ['produtos', 'Produtos'],
    ['endereco', 'Entrega'],
    ['revisao', 'Revisão'],
  ];

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await placeDeliveryOrder({
        slug,
        customer: contact,
        address,
        zoneId: zone,
        items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity, notes: i.notes })),
        notes,
        paymentMethodId: method || null,
        changeForCents: methodKind === 'dinheiro' ? parseCents(changeFor) : null,
        key: orderKey,
      });
      if (!r.ok) return setError(r.message);
      try {
        localStorage.setItem('pdp-delivery-contact', JSON.stringify(contact));
      } catch {}
      router.push(`${base}/delivery/pedido/${r.data.tracking_token}`);
    });

  if (!menu.open_now) {
    return (
      <div className="dl-closed">
        <h1>Estamos fechados agora</h1>
        <p>Confira nossos horários e volte em breve.</p>
      </div>
    );
  }

  const cartBox = (
    <aside className="dl-cart" aria-label="Sacola">
      <h2>Sua sacola</h2>
      {cart.length === 0 ? <p className="dl-muted">Vazia por enquanto.</p> : null}
      <ul>
        {cart.map((i) => (
          <li key={i.product_id}>
            <div className="dl-row">
              <span>
                {i.quantity}× {i.name}
              </span>
              <span>{formatCents(i.price_cents * i.quantity)}</span>
            </div>
            <div className="dl-row">
              <div className="dl-qty">
                <button type="button" aria-label="Diminuir" onClick={() => setCart(cart.flatMap((x) => (x === i ? (x.quantity > 1 ? [{ ...x, quantity: x.quantity - 1 }] : []) : [x])))}>
                  −
                </button>
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
      <dl className="dl-totals">
        <dt>Itens</dt>
        <dd>{formatCents(items)}</dd>
        {zoneData ? (
          <>
            <dt>Entrega ({zoneData.name})</dt>
            <dd>{formatCents(fee)}</dd>
          </>
        ) : null}
        <dt className="dl-strong">Total</dt>
        <dd className="dl-strong">{formatCents(items + fee)}</dd>
      </dl>
    </aside>
  );

  return (
    <div className="dl-store">
      <section className="dl-hero">
        <h1>Sabor que chega até você</h1>
        <p>{menu.eta_minutes ? `Entrega em cerca de ${menu.eta_minutes} minutos.` : 'Peça agora e acompanhe pelo link.'}</p>
      </section>
      <ol className="dl-steps" aria-label="Etapas do pedido">
        {steps.map(([s, label], i) => (
          <li key={s} aria-current={step === s ? 'step' : undefined}>
            <span>{i + 1}</span> {label}
          </li>
        ))}
      </ol>
      {error ? (
        <p className="dl-error" role="alert">
          {error}
        </p>
      ) : null}

      {step === 'contato' ? (
        <form
          className="dl-card dl-form"
          onSubmit={(e) => {
            e.preventDefault();
            setStep('produtos');
          }}
        >
          <h2>Para começar, seu WhatsApp</h2>
          <p className="dl-muted">Usamos o número para falar sobre o seu pedido. Nenhum cadastro é necessário.</p>
          <label className="dl-field">
            WhatsApp com DDD
            <input inputMode="tel" autoComplete="tel" value={contact.whatsapp} onChange={(e) => setContact({ ...contact, whatsapp: maskPhone(e.target.value) })} required />
          </label>
          <label className="dl-field">
            Seu nome
            <input autoComplete="name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} required />
          </label>
          <button type="submit" className="dl-btn" disabled={contact.whatsapp.replace(/\D/g, '').length < 10 || contact.name.trim().length < 2}>
            Ver cardápio
          </button>
        </form>
      ) : null}

      {step === 'produtos' ? (
        <div className="dl-shop">
          <div>
            <nav className="dl-cats" aria-label="Categorias">
              {menu.categories?.map((c) => (
                <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
                  {c.name}
                </button>
              ))}
            </nav>
            <div className="dl-products">
              {products.map((p) => (
                <article key={p.id} className="dl-product" data-available={p.available}>
                  {p.image_path ? <img src={mediaUrl(p.image_path) ?? ''} alt="" loading="lazy" /> : <span className="dl-photo" aria-hidden="true" />}
                  <div className="dl-product-body">
                    <h3>{p.name}</h3>
                    {p.description ? <p>{p.description}</p> : null}
                    <div className="dl-row">
                      <strong>{p.available ? formatCents(p.price_cents) : 'Indisponível'}</strong>
                      {p.available ? (
                        <button type="button" className="dl-add" onClick={() => add(p)} aria-label={`Adicionar ${p.name}`}>
                          +
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="dl-side">
            {cartBox}
            <div className="dl-row">
              <button type="button" className="dl-btn dl-btn--ghost" onClick={() => setStep('contato')}>
                Voltar
              </button>
              <button type="button" className="dl-btn" disabled={cart.length === 0} onClick={() => setStep('endereco')}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 'endereco' ? (
        <div className="dl-shop">
          <form
            className="dl-card dl-form"
            onSubmit={(e) => {
              e.preventDefault();
              setStep('revisao');
            }}
          >
            <h2>Onde entregamos?</h2>
            <label className="dl-field">
              Região de entrega
              <select value={zone} onChange={(e) => setZone(e.target.value)} required>
                {menu.zones?.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} — taxa {formatCents(z.fee_cents)}
                    {z.neighborhoods.length ? ` (${z.neighborhoods.join(', ')})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="dl-grid2">
              <label className="dl-field">
                Rua
                <input autoComplete="address-line1" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} required />
              </label>
              <label className="dl-field">
                Número
                <input value={address.number} onChange={(e) => setAddress({ ...address, number: e.target.value })} required />
              </label>
              <label className="dl-field">
                Bairro
                <input value={address.neighborhood} onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })} required />
              </label>
              <label className="dl-field">
                Complemento
                <input value={address.complement} onChange={(e) => setAddress({ ...address, complement: e.target.value })} />
              </label>
            </div>
            <label className="dl-field">
              Ponto de referência
              <input value={address.reference} onChange={(e) => setAddress({ ...address, reference: e.target.value })} />
            </label>
            <label className="dl-field">
              Observações do pedido
              <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
            </label>
            {belowMin && zoneData ? <p className="dl-error">Pedido mínimo para {zoneData.name}: {formatCents(zoneData.min_order_cents)}.</p> : null}
            <div className="dl-row">
              <button type="button" className="dl-btn dl-btn--ghost" onClick={() => setStep('produtos')}>
                Voltar
              </button>
              <button type="submit" className="dl-btn" disabled={belowMin || !zone}>
                Revisar pedido
              </button>
            </div>
          </form>
          <div className="dl-side">{cartBox}</div>
        </div>
      ) : null}

      {step === 'revisao' ? (
        <div className="dl-shop">
          <section className="dl-card dl-form" aria-labelledby="rev">
            <h2 id="rev">Confira e envie</h2>
            <dl className="dl-review">
              <dt>Contato</dt>
              <dd>
                {contact.name} · {contact.whatsapp}
              </dd>
              <dt>Entrega</dt>
              <dd>
                {address.street}, {address.number}
                {address.complement ? ` — ${address.complement}` : ''} · {address.neighborhood}
              </dd>
            </dl>
            <label className="dl-field">
              Forma de pagamento (na entrega)
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                {menu.payment_methods?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            {methodKind === 'dinheiro' ? (
              <label className="dl-field">
                Troco para (R$)
                <input inputMode="decimal" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} placeholder="Opcional" />
              </label>
            ) : null}
            <p className="dl-muted">O restaurante confirma o pedido antes de iniciar o preparo. Você acompanha tudo pelo link.</p>
            <div className="dl-row">
              <button type="button" className="dl-btn dl-btn--ghost" onClick={() => setStep('endereco')}>
                Voltar
              </button>
              <button type="button" className="dl-btn" disabled={pending} onClick={submit}>
                {pending ? 'Enviando…' : `Enviar pedido · ${formatCents(items + fee)}`}
              </button>
            </div>
          </section>
          <div className="dl-side">{cartBox}</div>
        </div>
      ) : null}
    </div>
  );
}
