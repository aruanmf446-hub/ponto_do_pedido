import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/core/supabase/server';
import { recoveryUser } from '@/core/auth/recovery';
import { safeAuthNext } from '@/core/auth/redirect';

/** Confirmação de e-mail e recuperação de senha (links do Supabase Auth). */
export async function confirmEmail(request: NextRequest) {
  const url = request.nextUrl;
  if (url.searchParams.get('type') === 'recovery') return confirmRecovery(request);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const nextParam = url.searchParams.get('next') ?? '/';
  const next = safeAuthNext(nextParam, '/');
  const emailChange = type === 'email_change' || url.searchParams.get('flow') === 'email-change';
  if (emailChange && url.searchParams.has('error'))
    return NextResponse.redirect(new URL('/portal/seguranca?erro=link-invalido', request.url));
  const base = request.headers.get('x-pdp-base') ?? '';
  const target = new URL(next.startsWith(base) ? next : `${base}${next}`, request.url);

  if (tokenHash && type) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      if (type === 'email_change') return NextResponse.redirect(new URL('/portal/seguranca?confirmacao=recebida', request.url));
      return NextResponse.redirect(target);
    }
    if (type === 'email_change') return NextResponse.redirect(new URL('/portal/seguranca?erro=link-invalido', request.url));
  }
  const code = url.searchParams.get('code');
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (await recoveryUser()) return NextResponse.redirect(new URL('/nova-senha', request.url));
      return NextResponse.redirect(target);
    }
    // PKCE depende do navegador que iniciou o cadastro. Em outro dispositivo,
    // a confirmação pode ter ocorrido, mas não há verifier para abrir a sessão.
    // Pedir login não cria sessão nem presume que a confirmação foi válida.
    const login = new URL(base ? `${base}/` : '/entrar', request.url);
    login.searchParams.set('next', next);
    login.searchParams.set('confirmacao', 'continuar');
    return NextResponse.redirect(login);
  }
  if (emailChange) return NextResponse.redirect(new URL('/portal/seguranca?confirmacao=recebida', request.url));
  return NextResponse.redirect(new URL(`${base}/?erro=link-invalido`, request.url));
}

/** Recuperação não aceita uma sessão comum nem o destino escolhido no query string. */
export async function confirmRecovery(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let valid = false;
  try {
    const supabase = await createServerSupabase();
    if (params.get('token_hash') && params.get('type') === 'recovery') {
      const result = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: params.get('token_hash')! });
      valid = !result.error;
    } else if (params.get('code')) {
      const result = await supabase.auth.exchangeCodeForSession(params.get('code')!);
      valid = !result.error;
    }
    valid = valid && Boolean(await recoveryUser());
  } catch {
    valid = false;
  }
  const response = NextResponse.redirect(new URL(valid ? '/nova-senha' : '/recuperar-senha?erro=link-invalido', request.url));
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
