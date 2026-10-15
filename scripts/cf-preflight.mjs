// Pré-verificação do deploy na Cloudflare. Confere o token e as permissões antes
// do build, para que a falha apareça aqui com a causa, e não como
// "Authentication error [code: 10000]" no meio do Wrangler.
// Uso: CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node scripts/cf-preflight.mjs
// Nunca imprime o token.

const API = 'https://api.cloudflare.com/client/v4';
const token = process.env.CLOUDFLARE_API_TOKEN ?? '';
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';

const problems = [];
if (!token) problems.push('CLOUDFLARE_API_TOKEN não definido (segredo do repositório).');
if (!accountId) problems.push('CLOUDFLARE_ACCOUNT_ID não definido (segredo do repositório).');
if (problems.length) fail(problems);

async function call(path) {
  let res;
  try {
    res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch (error) {
    fail([`Não foi possível falar com a API da Cloudflare (${error.cause?.code ?? error.message}). Verifique a rede do runner.`]);
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, ok: res.ok && body?.success !== false, errors: body?.errors ?? [], result: body?.result };
}

function fail(lines) {
  console.error('\n[cf-preflight] Deploy bloqueado antes do build:');
  for (const line of lines) console.error(`  - ${line}`);
  console.error(
    '\nCorreção: crie um token em https://dash.cloudflare.com/profile/api-tokens com:' +
      '\n  Account → Workers Scripts → Edit' +
      '\n  Account → Account Settings → Read' +
      '\n  Recursos da conta: somente a conta do CLOUDFLARE_ACCOUNT_ID.' +
      '\nDepois atualize o segredo CLOUDFLARE_API_TOKEN no repositório aruanmf446-hub/ponto_do_pedido.\n',
  );
  process.exit(1);
}

// 1) Token ativo.
const verify = await call('/user/tokens/verify');
if (!verify.ok || verify.result?.status !== 'active') {
  fail([
    `Token inválido, expirado ou desativado (HTTP ${verify.status}).`,
    ...verify.errors.map((e) => `Cloudflare: ${e.message} (código ${e.code})`),
  ]);
}

// 2) Conta acessível e permissão de Workers para ler os scripts.
const scripts = await call(`/accounts/${accountId}/workers/scripts`);
if (!scripts.ok) {
  const code = scripts.errors[0]?.code;
  const hint =
    code === 10000
      ? 'Código 10000: o token não tem Workers Scripts (Edit) nesta conta.'
      : 'Verifique se o token cobre esta conta e a permissão Workers Scripts.';
  fail([
    `Sem acesso aos Workers da conta (HTTP ${scripts.status}). ${hint}`,
    ...scripts.errors.map((e) => `Cloudflare: ${e.message} (código ${e.code})`),
  ]);
}

console.log(`[cf-preflight] OK: token ativo e acesso aos Workers da conta ${accountId}.`);
