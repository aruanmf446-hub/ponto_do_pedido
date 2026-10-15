'use client';
import { createBrowserClient } from '@supabase/ssr';
import { config } from '@/core/config';

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Cliente do navegador (publicável). Usado para Realtime e consultas públicas. */
export function browserSupabase() {
  if (!client) {
    const host = typeof window === 'undefined' ? '' : window.location.hostname;
    const root = config.rootDomain;
    const domain = host === root || host.endsWith(`.${root}`) ? `.${root}` : undefined;
    client = createBrowserClient(config.app.url, config.app.publishableKey, {
      cookieOptions: domain ? { domain } : {},
    });
  }
  return client;
}
