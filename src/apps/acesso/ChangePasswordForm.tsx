'use client';

import { useActionState } from 'react';
import { changePassword } from '@/apps/acesso/actions';

export function ChangePasswordForm({ slug }: { slug: string }) {
  const [error, action, pending] = useActionState(changePassword.bind(null, slug), null);
  return (
    <form action={action} className="ac-form" noValidate>
      <label className="ac-field">
        <span>Nova senha</span>
        <input type="password" name="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label className="ac-field">
        <span>Confirme a nova senha</span>
        <input type="password" name="confirm" autoComplete="new-password" minLength={8} required />
      </label>
      {error ? (
        <p role="alert" className="ac-error">
          {error.message}
        </p>
      ) : null}
      <button type="submit" className="ac-primary" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar e continuar'}
      </button>
    </form>
  );
}
