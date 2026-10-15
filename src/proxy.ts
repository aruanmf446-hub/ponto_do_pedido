import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { config as appConfig } from '@/core/config';
import { withCookieDomain } from '@/core/supabase/cookies';
import { resolveHost } from '@/core/tenant/host';

// Proxy (antigo middleware): identifica o restaurante pelo hostname, reescreve
// para as rotas internas /r/<slug>/... e renova a sessão do Supabase.
export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const host = request.headers.get('host');
  const target = resolveHost(host, url.pathname, appConfig.rootDomain, appConfig.pathTenants);

  const requestHeaders = new Headers(request.headers);
  let response: NextResponse;

  if (target.kind === 'invalid') {
    return new NextResponse('Estabelecimento não encontrado.', { status: 404 });
  }

  if (target.kind === 'tenant' && target.mode === 'subdomain') {
    // /r/<slug> só existe internamente; no subdomínio o caminho é o do app.
    if (url.pathname.startsWith('/r/')) return new NextResponse('Não encontrado.', { status: 404 });
    requestHeaders.set('x-pdp-tenant', target.slug);
    requestHeaders.set('x-pdp-base', '');
    const rewritten = url.clone();
    rewritten.pathname = `/r/${target.slug}${url.pathname === '/' ? '' : url.pathname}`;
    response = NextResponse.rewrite(rewritten, { request: { headers: requestHeaders } });
  } else if (target.kind === 'tenant') {
    requestHeaders.set('x-pdp-tenant', target.slug);
    requestHeaders.set('x-pdp-base', `/r/${target.slug}`);
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    requestHeaders.delete('x-pdp-tenant');
    requestHeaders.set('x-pdp-base', '');
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Renovação da sessão (grava cookies atualizados na resposta)
  if (appConfig.app.url && appConfig.app.publishableKey) {
    const supabase = createServerClient(appConfig.app.url, appConfig.app.publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet, headers) {
          for (const { name, value, options } of toSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, withCookieDomain(options, host));
          }
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    });
    await supabase.auth.getClaims();
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
};
