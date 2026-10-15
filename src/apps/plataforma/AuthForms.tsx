'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signInPlatform, signUpSubscriber } from '@/apps/plataforma/actions';

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUpSubscriber, null);
  if (state && state.ok) {
    return (
      <div className="pl-card" role="status">
        <h2>Confirme seu e-mail</h2>
        <p>
          Enviamos um link para <strong>{state.email}</strong>. Depois de confirmar, você continua a contratação.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="pl-form" noValidate>
      <input type="hidden" name="next" value={next} />
      <label className="pl-field">
        Nome completo
        <input name="name" autoComplete="name" required />
      </label>
      <label className="pl-field">
        E-mail
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <label className="pl-field">
        Senha
        <input type="password" name="password" autoComplete="new-password" minLength={8} required />
        <small>Mínimo de 8 caracteres. É a mesma senha para o portal e para operar o restaurante.</small>
      </label>
      {state && !state.ok ? (
        <p role="alert" className="pl-error">
          {state.message}
        </p>
      ) : null}
      <button type="submit" className="pl-btn" disabled={pending}>
        {pending ? 'Criando conta…' : 'Criar conta'}
      </button>
      <p className="pl-muted">
        Já tem conta? <Link href={`/entrar?next=${encodeURIComponent(next)}`}>Entrar</Link>
      </p>
    </form>
  );
}

export function SigninForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(signInPlatform, null);
  return (
    <form action={action} className="pl-form" noValidate>
      <input type="hidden" name="next" value={next} />
      <label className="pl-field">
        E-mail
        <input type="email" name="email" autoComplete="username" required />
      </label>
      <label className="pl-field">
        Senha
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      {error ? (
        <p role="alert" className="pl-error">
          {error.message}
        </p>
      ) : null}
      <button type="submit" className="pl-btn" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="pl-muted">
        Ainda não é assinante? <Link href="/planos">Conheça os planos</Link>
      </p>
    </form>
  );
}
