// Utilitários puros do Mercado Pago (sem Deno, sem rede): verificação da
// assinatura dos webhooks e montagem da assinatura recorrente. Testados em
// tests/unit/mercadopago.test.ts.

export const MP_API = 'https://api.mercadopago.com';

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Lê "ts=...,v1=..." do cabeçalho x-signature. */
export function parseSignature(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const index = part.indexOf('=');
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    }),
  );
  return parts.ts && parts.v1 ? { ts: parts.ts, v1: parts.v1 } : null;
}

/**
 * Valida o x-signature do webhook: HMAC-SHA256 (chave secreta do webhook) sobre
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. O data.id alfanumérico entra
 * em minúsculas; partes ausentes são omitidas do manifesto.
 */
export async function verifySignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}): Promise<boolean> {
  const sig = parseSignature(input.xSignature);
  if (!sig || !input.secret) return false;
  let manifest = '';
  if (input.dataId) manifest += `id:${/^[a-z0-9]+$/i.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId};`;
  if (input.xRequestId) manifest += `request-id:${input.xRequestId};`;
  manifest += `ts:${sig.ts};`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(input.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)));
  return timingSafeEqual(signed, sig.v1.toLowerCase());
}

export type PreapprovalInput = {
  subscriptionId: string;
  reason: string;
  payerEmail: string;
  amountCents: number;
  period: 'monthly' | 'yearly';
  backUrl: string;
};

/** Assinatura recorrente sem plano associado, em estado pendente (o cliente autoriza no checkout). */
export function buildPreapprovalBody(input: PreapprovalInput) {
  return {
    reason: input.reason,
    external_reference: input.subscriptionId,
    payer_email: input.payerEmail,
    auto_recurring: {
      frequency: input.period === 'yearly' ? 12 : 1,
      frequency_type: 'months',
      transaction_amount: Number((input.amountCents / 100).toFixed(2)),
      currency_id: 'BRL',
    },
    back_url: input.backUrl,
    status: 'pending',
  };
}

export type WebhookTarget =
  | { kind: 'preapproval'; path: string; key: string }
  | { kind: 'authorized_payment'; path: string; key: string }
  | null;

/** Que recurso consultar na API para cada tópico de assinatura. */
export function webhookTarget(type: string | null, dataId: string | null): WebhookTarget {
  if (!dataId || !/^[A-Za-z0-9_-]{1,80}$/.test(dataId)) return null;
  if (type === 'subscription_preapproval') return { kind: 'preapproval', path: `/preapproval/${dataId}`, key: `preapproval:${dataId}` };
  if (type === 'subscription_authorized_payment') {
    return { kind: 'authorized_payment', path: `/authorized_payments/${dataId}`, key: `authorized_payment:${dataId}` };
  }
  return null;
}

/** Chave de idempotência do evento: inclui o estado, para processar cada mudança uma vez. */
export function eventKey(target: NonNullable<WebhookTarget>, resource: { status?: string; payment?: { status?: string } }): string {
  return `${target.key}:${resource.status ?? 'unknown'}:${resource.payment?.status ?? ''}`;
}
