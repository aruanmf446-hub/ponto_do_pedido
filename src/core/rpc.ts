import 'server-only';
import { fromPostgrest, ok, type ActionResult } from '@/core/errors';
import { createServerSupabase } from '@/core/supabase/server';

/**
 * Chama uma RPC do projeto operacional com a identidade do usuário. Toda
 * validação de permissão, limite, estado e idempotência acontece no banco.
 */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<ActionResult<T>> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return fromPostgrest(error);
  return ok(data as T);
}

/** Leitura via RPC que deve ter sucesso (lança em caso de erro). */
export async function rpcRead<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const result = await rpc<T>(fn, args);
  if (!result.ok) throw new Error(result.message);
  return result.data;
}
