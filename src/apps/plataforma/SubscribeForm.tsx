'use client';

import Link from 'next/link';
import { useActionState, useEffect, useMemo, useState } from 'react';
import type { Plan } from '@/core/plans';
import { tenantDisplayUrl } from '@/core/tenant/urls';
import { checkSlug, subscribe } from '@/apps/plataforma/actions';

function toSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function SubscribeForm({
  plans,
  initialPlan,
  checkoutAvailable,
}: {
  plans: Plan[];
  initialPlan: string;
  checkoutAvailable: boolean;
}) {
  const [error, action, pending] = useActionState(subscribe, null);
  const [restaurant, setRestaurant] = useState('');
  const [slug, setSlug] = useState('');
  const [touched, setTouched] = useState(false);
  const [available, setAvailable] = useState<{ slug: string; value: boolean } | null>(null);
  const key = useMemo(() => crypto.randomUUID(), []);
  const effectiveSlug = touched ? slug : toSlug(restaurant);

  useEffect(() => {
    if (effectiveSlug.length < 3) return;
    let active = true;
    const t = setTimeout(async () => {
      const ok = await checkSlug(effectiveSlug);
      if (active) setAvailable({ slug: effectiveSlug, value: ok });
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [effectiveSlug]);

  const status = effectiveSlug.length < 3 || available?.slug !== effectiveSlug ? null : available.value;

  return (
    <form action={action} className="pl-form" noValidate>
      <input type="hidden" name="key" value={key} />
      <label className="pl-field">
        Plano
        <select name="plan" defaultValue={initialPlan}>
          {plans.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name} — {p.tagline}
            </option>
          ))}
        </select>
      </label>
      <label className="pl-field">
        Nome do restaurante
        <input name="restaurant" value={restaurant} onChange={(e) => setRestaurant(e.target.value)} required maxLength={120} />
      </label>
      <label className="pl-field">
        Endereço do restaurante
        <input
          name="slug"
          value={effectiveSlug}
          onChange={(e) => {
            setTouched(true);
            setSlug(toSlug(e.target.value));
          }}
          required
          inputMode="url"
          aria-describedby="slug-help"
        />
        <small id="slug-help">
          {tenantDisplayUrl(effectiveSlug || 'seurestaurante')} —{' '}
          {status === true
            ? 'identificador disponível'
            : status === false
              ? 'identificador indisponível'
              : 'letras minúsculas, números e hífen'}
        </small>
      </label>
      <label className="pl-check">
        <input type="checkbox" name="terms" required />
        <span>
          Li e aceito os <Link href="/termos">termos de uso</Link>. Sou o titular da assinatura.
        </span>
      </label>
      {error ? (
        <p role="alert" className="pl-error">
          {error.message}
        </p>
      ) : null}
      <p className="pl-muted" role="status">
        {checkoutAvailable
          ? 'O restaurante e os aplicativos serão liberados somente após a confirmação do pagamento.'
          : 'Novas contratações estão temporariamente indisponíveis. Nenhum pagamento será solicitado agora.'}
      </p>
      <button type="submit" className="pl-btn" disabled={!checkoutAvailable || pending || status === false}>
        {pending ? 'Registrando…' : checkoutAvailable ? 'Continuar para pagamento' : 'Contratação indisponível'}
      </button>
    </form>
  );
}
