// Edge Function `mercadopago-webhook` (projeto assinaturas).
//
// Recebe as notificações do Mercado Pago. A autenticidade vem do x-signature
// (segredo do webhook em MP_WEBHOOK_SECRET, secret do Supabase deste projeto);
// por isso verify_jwt é falso. A notificação traz só o id: o recurso é sempre
// consultado na API do Mercado Pago com MP_ACCESS_TOKEN antes de qualquer
// mudança. Nenhum segredo vai para o navegador nem para o app do restaurante.
import { eventKey, MP_API, verifySignature, webhookTarget } from '../_shared/mercadopago.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

function secretKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}

const SECRET = secretKey();
const adminHeaders: Record<string, string> = { apikey: SECRET, 'Content-Type': 'application/json' };
if (!SECRET.startsWith('sb_')) adminHeaders.Authorization = `Bearer ${SECRET}`;

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'METHOD' });

  const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET');
  const accessToken = Deno.env.get('MP_ACCESS_TOKEN');
  if (!webhookSecret || !accessToken) return reply(503, { error: 'NOT_CONFIGURED' });

  const url = new URL(req.url);
  const dataId = url.searchParams.get('data.id');
  const valid = await verifySignature({
    xSignature: req.headers.get('x-signature'),
    xRequestId: req.headers.get('x-request-id'),
    dataId,
    secret: webhookSecret,
  });
  if (!valid) return reply(401, { error: 'INVALID_SIGNATURE' });

  const type = url.searchParams.get('type') ?? url.searchParams.get('topic');
  const target = webhookTarget(type, dataId);
  if (!target) return reply(200, { ignored: true });

  // O Mercado Pago repete a notificação em respostas fora de 2xx.
  const res = await fetch(`${MP_API}${target.path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return reply(502, { error: 'PROVIDER_UNAVAILABLE' });
  const resource = (await res.json()) as { status?: string; payment?: { status?: string } };

  const applied = await fetch(`${SUPABASE_URL}/rest/v1/rpc/billing_apply_mercadopago`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ p_event_key: eventKey(target, resource), p_kind: target.kind, p_resource: resource }),
  });
  if (!applied.ok) return reply(500, { error: 'APPLY_FAILED' });
  return reply(200, { ok: true });
});
