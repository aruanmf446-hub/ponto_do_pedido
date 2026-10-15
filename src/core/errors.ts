// Resultado padronizado das ações (Server Actions) e mapeamento de erros das RPCs.

export type ActionOk<T> = { ok: true; data: T };
export type ActionFail = {
  ok: false;
  code: string;
  message: string;
  /** Permissão envolvida quando a ação exige aprovação. */
  permission?: string;
};
export type ActionResult<T = unknown> = ActionOk<T> | ActionFail;

type PostgrestLikeError = { message?: string; details?: string | null; hint?: string | null; code?: string };

const FRIENDLY: Record<string, string> = {
  '23505': 'Já existe um registro com esses dados.',
  '23503': 'Este registro está vinculado a outros dados.',
  '42501': 'Você não tem permissão para esta ação.',
  PGRST301: 'Sessão expirada. Entre novamente.',
};

export function fromPostgrest(error: PostgrestLikeError): ActionFail {
  const code = error.details && /^[A-Z_]+$/.test(error.details) ? error.details : (error.code ?? 'ERROR');
  const message =
    code === error.details ? (error.message ?? 'Erro inesperado.') : (FRIENDLY[error.code ?? ''] ?? error.message ?? 'Erro inesperado.');
  const fail: ActionFail = { ok: false, code, message };
  if (code === 'APPROVAL_REQUIRED' && error.hint) fail.permission = error.hint;
  return fail;
}

export function failure(code: string, message: string): ActionFail {
  return { ok: false, code, message };
}

export function ok<T>(data: T): ActionOk<T> {
  return { ok: true, data };
}
