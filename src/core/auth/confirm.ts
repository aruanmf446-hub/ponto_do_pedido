import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/core/supabase/server';
import { safeAuthNext } from '@/core/auth/redirect';

/** Confirmação de e-mail e recuperação de senha (links do Supabase Auth). */
export async function confirmEmail(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const nextParam = url.searchParams.get('next') ?? '/';
  const next = safeAuthNext(nextParam, '/');
  const base = request.headers.get('x-pdp-base') ?? '';
  const target = new URL(next.startsWith(base) ? next : `${base}${next}`, request.url);

  if (tokenHash && type) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(target);
  }
  const code = url.searchParams.get('code');
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(target);
    // PKCE depende do navegador que iniciou o cadastro. Em outro dispositivo,
    // a confirmação pode ter ocorrido, mas não há verifier para abrir a sessão.
    // Pedir login não cria sessão nem presume que a confirmação foi válida.
    const login = new URL(base ? `${base}/` : '/entrar', request.url);
    login.searchParams.set('next', next);
    login.searchParams.set('confirmacao', 'continuar');
    return NextResponse.redirect(login);
  }
  return NextResponse.redirect(new URL(`${base}/?erro=link-invalido`, request.url));
}
