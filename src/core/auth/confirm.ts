import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/core/supabase/server';

/** Confirmação de e-mail e recuperação de senha (links do Supabase Auth). */
export async function confirmEmail(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const nextParam = url.searchParams.get('next') ?? '/';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';
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
  }
  return NextResponse.redirect(new URL(`${base}/?erro=link-invalido`, request.url));
}
