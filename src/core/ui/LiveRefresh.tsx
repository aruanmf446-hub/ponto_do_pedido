'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { browserSupabase } from '@/core/supabase/browser';

export type LiveEvent = { table: string; type: 'INSERT' | 'UPDATE' | 'DELETE'; record: Record<string, unknown>; old: Record<string, unknown> };

/**
 * Atualiza a tela quando o estado operacional muda em outro dispositivo ou
 * aplicativo (Supabase Realtime, respeitando RLS). Também repete a consulta
 * periodicamente como salvaguarda em redes instáveis.
 */
export function LiveRefresh({
  tenantId,
  tables,
  onEvent,
  fallbackSeconds = 30,
}: {
  tenantId: string;
  tables: string[];
  onEvent?: (event: LiveEvent) => void;
  fallbackSeconds?: number;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  const key = tables.join(',');

  useEffect(() => {
    const supabase = browserSupabase();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };
    let channel = supabase.channel(`live:${tenantId}:${key}`);
    for (const table of key.split(',')) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `tenant_id=eq.${tenantId}` },
        (payload: { eventType: LiveEvent['type']; new: unknown; old: unknown }) => {
          handler.current?.({
            table,
            type: payload.eventType,
            record: (payload.new ?? {}) as Record<string, unknown>,
            old: (payload.old ?? {}) as Record<string, unknown>,
          });
          refresh();
        },
      );
    }
    channel.subscribe();
    const interval = setInterval(() => router.refresh(), fallbackSeconds * 1000);
    return () => {
      clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [tenantId, key, router, fallbackSeconds]);

  return null;
}
