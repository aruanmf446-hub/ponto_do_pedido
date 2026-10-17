'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  requestEmailChange,
  requestPasswordRecovery,
  saveRecoveredPassword,
  type SecurityState,
} from '@/apps/plataforma/security-actions';

export function SecurityForm({ mode }: { mode: 'request' | 'password' | 'email' }) {
  const handler = mode === 'request' ? requestPasswordRecovery : mode === 'password' ? saveRecoveredPassword : requestEmailChange;
  const [state, action, pending] = useActionState<SecurityState, FormData>(handler, null);
  return (
    <form action={action} className="pl-form" noValidate>
      {mode !== 'password' ? (
        <label className="pl-field">
          {mode === 'email' ? 'Novo e-mail' : 'E-mail'}
          <input name="email" type="email" autoComplete="email" required />
        </label>
      ) : null}
      {mode !== 'request' ? (
        <label className="pl-field">
          {mode === 'email' ? 'Senha atual' : 'Nova senha'}
          <input
            name="password"
            type="password"
            autoComplete={mode === 'email' ? 'current-password' : 'new-password'}
            minLength={mode === 'password' ? 8 : undefined}
            required
          />
        </label>
      ) : null}
      {mode === 'password' ? (
        <label className="pl-field">
          Confirme a nova senha
          <input name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
          <small>Mínimo de 8 caracteres.</small>
        </label>
      ) : null}
      {state ? (
        <p role={state.ok ? 'status' : 'alert'} className={state.ok ? 'pl-note' : 'pl-error'}>
          {state.message}
        </p>
      ) : null}
      <button className="pl-btn" type="submit" disabled={pending || state?.ok === true}>
        {pending
          ? 'Processando…'
          : mode === 'request'
            ? 'Solicitar recuperação'
            : mode === 'password'
              ? 'Salvar nova senha'
              : 'Solicitar alteração de e-mail'}
      </button>
      {state && !state.ok && state.code === 'AUTH_REQUIRED' ? (
        <Link href="/entrar?next=/portal/seguranca">Entrar novamente</Link>
      ) : null}
      {state && !state.ok && state.code === 'RECOVERY_REQUIRED' ? <Link href="/recuperar-senha">Solicitar novo link</Link> : null}
      {mode === 'request' ? (
        <p>
          <Link href="/entrar">Voltar para entrar</Link>
        </p>
      ) : null}
    </form>
  );
}
