'use client';

import { useActionState, useState } from 'react';
import { requestPasswordReset, signInToTenant } from '@/apps/acesso/actions';

export function LoginForm({ slug, next }: { slug: string; next: string | null }) {
  const [error, formAction, pending] = useActionState(signInToTenant.bind(null, slug), null);
  const [reset, resetAction, resetPending] = useActionState(requestPasswordReset, null);
  const [mode, setMode] = useState<'login' | 'reset'>('login');

  if (mode === 'reset') {
    return (
      <form action={resetAction} className="ac-form" noValidate>
        <h2>Recuperar acesso</h2>
        {reset?.done ? (
          <p role="status" className="ac-ok">
            Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.
          </p>
        ) : (
          <>
            <label className="ac-field">
              <span>E-mail</span>
              <input type="email" name="email" autoComplete="email" required />
            </label>
            {reset?.error ? (
              <p role="alert" className="ac-error">
                {reset.error}
              </p>
            ) : null}
            <button type="submit" className="ac-primary" disabled={resetPending}>
              {resetPending ? 'Enviando…' : 'Enviar link'}
            </button>
          </>
        )}
        <button type="button" className="ac-link" onClick={() => setMode('login')}>
          Voltar ao login
        </button>
      </form>
    );
  }

  return (
    <form action={formAction} className="ac-form" noValidate>
      <input type="hidden" name="next" value={next ?? ''} />
      <label className="ac-field">
        <span>E-mail</span>
        <input type="email" name="email" autoComplete="username" required />
      </label>
      <label className="ac-field">
        <span>Senha</span>
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      {error ? (
        <p role="alert" className="ac-error">
          {error.message}
        </p>
      ) : null}
      <button type="submit" className="ac-primary" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
      <button type="button" className="ac-link" onClick={() => setMode('reset')}>
        Esqueci minha senha
      </button>
    </form>
  );
}
