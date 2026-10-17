'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerSupabase } from '@/core/supabase/server';
import { recoveryUser } from '@/core/auth/recovery';
import { failure, type ActionFail } from '@/core/errors';

export type SecurityState = ActionFail | { ok: true; message: string } | null;
const EMAIL_NOTICE =
  'Se houver uma conta elegível e a solicitação puder ser processada, você receberá instruções de recuperação. Confira também o spam. Se não receber, aguarde alguns minutos e tente novamente.';
const CHANGE_NOTICE =
  'Confira as caixas de entrada do endereço atual e do novo endereço. A alteração só estará concluída após as confirmações exigidas pelo Supabase. Até lá, continue usando o e-mail atual.';

async function callback(path: string) {
  const h = await headers();
  const host = h.get('host') ?? '';
  const protocol = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http' : 'https';
  return new URL(path, `${protocol}://${host}`).toString();
}

export async function requestPasswordRecovery(_previous: SecurityState, form: FormData): Promise<SecurityState> {
  const parsed = z.email().safeParse(String(form.get('email') ?? '').trim());
  if (!parsed.success) return failure('INVALID', 'Informe um e-mail válido.');
  const supabase = await createServerSupabase();
  try {
    // Resposta deliberadamente igual para conta inexistente, repetição e limites de envio.
    await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: await callback('/auth/recuperar') });
  } catch {
    return failure('UNAVAILABLE', 'Não foi possível solicitar a recuperação agora. Tente novamente em instantes.');
  }
  return { ok: true, message: EMAIL_NOTICE };
}

export async function saveRecoveredPassword(_previous: SecurityState, form: FormData): Promise<SecurityState> {
  const password = String(form.get('password') ?? '');
  if (password.length < 8) return failure('INVALID', 'Use uma senha com pelo menos 8 caracteres.');
  if (password !== form.get('confirmation')) return failure('INVALID', 'As senhas não coincidem.');
  if (!(await recoveryUser()))
    return failure('RECOVERY_REQUIRED', 'O link está inválido ou expirou. Solicite uma nova recuperação.');
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error?.status === 401) return failure('RECOVERY_REQUIRED', 'A sessão de recuperação expirou. Solicite um novo link.');
  if (error)
    return failure(
      'PASSWORD_FAILED',
      'Não foi possível alterar a senha. Use uma senha diferente e confira se o link ainda é válido.',
    );
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError)
    return {
      ok: true,
      message: 'Senha alterada. Não foi possível encerrar a sessão agora; saia da conta antes de entrar novamente.',
    };
  redirect('/entrar?senha=alterada');
}

export async function requestEmailChange(_previous: SecurityState, form: FormData): Promise<SecurityState> {
  const email = z.email().safeParse(String(form.get('email') ?? '').trim());
  if (!email.success) return failure('INVALID', 'Informe um e-mail válido.');
  const supabase = await createServerSupabase();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user?.email) return failure('AUTH_REQUIRED', 'Sessão expirada. Entre novamente.');
  const password = String(form.get('password') ?? '');
  if (!password) return failure('INVALID', 'Informe sua senha atual.');
  if (email.data.toLowerCase() === data.user.email.toLowerCase())
    return failure('INVALID', 'Informe um endereço diferente do e-mail atual.');
  const { error: passwordError } = await supabase.auth.signInWithPassword({ email: data.user.email, password });
  if (passwordError) return failure('AUTH_FAILED', 'Não foi possível confirmar sua senha atual.');
  const { error } = await supabase.auth.updateUser(
    { email: email.data },
    { emailRedirectTo: await callback('/auth/confirm?flow=email-change&next=/portal/seguranca') },
  );
  if (error?.status === 401) return failure('AUTH_REQUIRED', 'Sessão expirada. Entre novamente.');
  // Não revelar se o novo endereço já pertence a outra conta.
  if (error && !['email_exists', 'user_already_exists'].includes(error.code ?? '')) {
    return failure('EMAIL_FAILED', 'Não foi possível solicitar a alteração. Verifique o endereço e tente novamente mais tarde.');
  }
  return { ok: true, message: CHANGE_NOTICE };
}
