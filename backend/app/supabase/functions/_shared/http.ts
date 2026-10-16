// Utilitários das Edge Functions sem dependências externas: apenas fetch nas
// APIs REST e Auth do próprio projeto.

const ALLOWED_ORIGIN = Deno.env.get('PDP_ALLOWED_ORIGIN') ?? '*';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';

export const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

export function fail(code: string, message: string, status = 400) {
  return json({ error: { code, message } }, status);
}

function fromKeys(name: string, legacy: string): string {
  const keys = Deno.env.get(name);
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch {
      /* Compatibilidade com a chave legada fornecida pela plataforma. */
    }
  }
  return Deno.env.get(legacy) ?? '';
}

const SECRET_KEY = fromKeys('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
export const PUBLISHABLE_KEY = fromKeys('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');

export function integrationConfigured(): boolean {
  return Boolean(SUPABASE_URL && SECRET_KEY && PUBLISHABLE_KEY);
}

/** Cabeçalhos com a chave secreta (novas chaves vão só no apikey). */
function adminHeaders(): Record<string, string> {
  const headers: Record<string, string> = { apikey: SECRET_KEY, 'Content-Type': 'application/json' };
  if (!SECRET_KEY.startsWith('sb_')) headers.Authorization = `Bearer ${SECRET_KEY}`;
  return headers;
}

export type RpcResult<T> = { data: T | null; error: { message: string; details?: string; code?: string } | null };

async function rpcCall<T>(fn: string, args: unknown, headers: Record<string, string>): Promise<RpcResult<T>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) return { data: null, error: body ?? { message: res.statusText } };
  return { data: body as T, error: null };
}

/** RPC com a chave secreta (ignora RLS; usar apenas após validar a identidade). */
export function adminRpc<T>(fn: string, args: unknown) {
  return rpcCall<T>(fn, args, adminHeaders()).catch(() => ({
    data: null,
    error: { message: 'Falha ao consultar o banco operacional.' },
  }));
}

/** RPC com a identidade do usuário (respeita RLS e as regras das funções). */
export function userRpc<T>(token: string, fn: string, args: unknown) {
  return rpcCall<T>(fn, args, { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
}

export function bearer(req: Request): string | null {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

export type AuthUser = { id: string; email: string; user_metadata?: { full_name?: string } };

/** Valida o token no Auth deste projeto (autoridade de identidade). */
export async function currentUser(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      // Apenas status HTTP: nunca registrar token, chaves, cabeçalhos ou payload do Auth.
      console.warn('AUTH_USER_REJECTED', { status: res.status });
      return null;
    }
    const user = (await res.json()) as AuthUser;
    if (!user?.id) console.warn('AUTH_USER_MISSING_ID');
    return user?.id ? user : null;
  } catch (error) {
    console.error('AUTH_USER_UNREACHABLE', { cause: error instanceof Error ? error.name : 'unknown' });
    return null;
  }
}

export async function adminCreateUser(email: string, password: string, fullName: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
  });
  const body = await res.json();
  if (!res.ok) return { user: null, error: (body?.msg ?? body?.message ?? 'Falha ao criar acesso.') as string };
  return { user: body as AuthUser, error: null };
}

export async function adminDeleteUser(id: string) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders() });
}
