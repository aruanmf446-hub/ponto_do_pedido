// Edge Function `team` (projeto pontodopedido).
//
// Cadastro de colaboradores sem contas duplicadas:
// - valida o solicitante pelo token e confirma, com a identidade dele, que pode
//   cadastrar colaboradores no estabelecimento;
// - se o e-mail já tem conta, apenas vincula (a pessoa usa a mesma senha);
// - se não tem, cria a conta com senha temporária (troca obrigatória no 1º acesso);
// - o vínculo e as funções são validados novamente no banco (admin_attach_member),
//   que impede delegar permissões que o solicitante não pode repassar.
import { adminCreateUser, adminDeleteUser, adminRpc, bearer, cors, currentUser, fail, json, userRpc } from '../_shared/http.ts';


const APPS = ['gestao', 'caixa', 'atendimento', 'cozinha', 'cardapio', 'delivery', 'financeiro', 'estoque'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('METHOD', 'Use POST.', 405);
  const token = bearer(req);
  if (!token) return fail('AUTH_REQUIRED', 'Sessão expirada.', 401);
  const actor = await currentUser(token);
  if (!actor) return fail('AUTH_REQUIRED', 'Sessão expirada.', 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tenantId = String(body.tenant_id ?? '');
  const email = String(body.email ?? '').trim().toLowerCase();
  const fullName = String(body.full_name ?? '').trim();
  const jobTitle = String(body.job_title ?? '').trim() || null;
  const primaryApp = String(body.primary_app ?? '');
  const roleIds = Array.isArray(body.role_ids) ? body.role_ids.map(String) : [];
  const tempPassword = String(body.temporary_password ?? '');

  if (!/^[0-9a-f-]{36}$/.test(tenantId)) return fail('INVALID', 'Estabelecimento inválido.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('INVALID', 'Informe um e-mail válido.');
  if (fullName.length < 2) return fail('INVALID', 'Informe o nome do colaborador.');
  if (!APPS.includes(primaryApp)) return fail('INVALID', 'Escolha a área principal do colaborador.');

  // Autoridade verificada com a identidade do solicitante
  const decision = await userRpc<string>(token, 'check_permission', {
    p_tenant: tenantId,
    p_permission: 'gestao.equipe.cadastrar',
  });
  if (decision.error || decision.data !== 'direct') {
    return fail('FORBIDDEN', 'Você não tem permissão para cadastrar colaboradores.', 403);
  }

  const existing = await adminRpc<string | null>('admin_find_user_by_email', { p_email: email });
  let userId = existing.data;
  let created = false;
  if (!userId) {
    if (tempPassword.length < 8) return fail('INVALID', 'A senha temporária precisa ter ao menos 8 caracteres.');
    const result = await adminCreateUser(email, tempPassword, fullName);
    if (!result.user) return fail('CREATE_FAILED', result.error ?? 'Não foi possível criar o acesso.');
    userId = result.user.id;
    created = true;
  }

  const attached = await adminRpc<string>('admin_attach_member', {
    p_actor: actor.id,
    p_tenant: tenantId,
    p_user: userId,
    p_display_name: fullName,
    p_job_title: jobTitle,
    p_primary_app: primaryApp,
    p_role_ids: roleIds,
    p_must_change_password: created,
  });
  if (attached.error) {
    if (created) await adminDeleteUser(userId);
    return fail(attached.error.details ?? 'ERROR', attached.error.message);
  }
  return json({ membership_id: attached.data, created_account: created, email_sent: false });
});
