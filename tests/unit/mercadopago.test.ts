import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildPreapprovalBody,
  eventKey,
  parseSignature,
  verifySignature,
  webhookTarget,
} from '../../backend/billing/supabase/functions/_shared/mercadopago';

const SECRET = 'segredo-de-teste';
const sign = (manifest: string, secret = SECRET) => createHmac('sha256', secret).update(manifest).digest('hex');

describe('assinatura do webhook do Mercado Pago', () => {
  it('lê ts e v1 do cabeçalho', () => {
    expect(parseSignature('ts=1704908010,v1=abc')).toEqual({ ts: '1704908010', v1: 'abc' });
    expect(parseSignature('v1=abc')).toBeNull();
    expect(parseSignature(null)).toBeNull();
  });

  it('aceita a assinatura correta, com data.id em minúsculas', async () => {
    const v1 = sign('id:abc123;request-id:req-1;ts:1704908010;');
    const ok = await verifySignature({
      xSignature: `ts=1704908010,v1=${v1}`,
      xRequestId: 'req-1',
      dataId: 'ABC123',
      secret: SECRET,
    });
    expect(ok).toBe(true);
  });

  it('omite do manifesto as partes ausentes', async () => {
    const v1 = sign('id:abc123;ts:1704908010;');
    expect(
      await verifySignature({ xSignature: `ts=1704908010,v1=${v1}`, xRequestId: null, dataId: 'abc123', secret: SECRET }),
    ).toBe(true);
  });

  it('rejeita segredo errado, corpo adulterado e cabeçalho ausente', async () => {
    const v1 = sign('id:abc123;request-id:req-1;ts:1704908010;', 'outro-segredo');
    const header = `ts=1704908010,v1=${v1}`;
    expect(await verifySignature({ xSignature: header, xRequestId: 'req-1', dataId: 'abc123', secret: SECRET })).toBe(false);
    const good = `ts=1704908010,v1=${sign('id:abc123;request-id:req-1;ts:1704908010;')}`;
    expect(await verifySignature({ xSignature: good, xRequestId: 'req-1', dataId: 'zzz999', secret: SECRET })).toBe(false);
    expect(await verifySignature({ xSignature: null, xRequestId: 'req-1', dataId: 'abc123', secret: SECRET })).toBe(false);
    expect(await verifySignature({ xSignature: good, xRequestId: 'req-1', dataId: 'abc123', secret: '' })).toBe(false);
  });
});

describe('assinatura recorrente', () => {
  const base = {
    subscriptionId: '8d0c0d5c-0000-4000-8000-000000000001',
    reason: 'Plano',
    payerEmail: 'dono@teste.local',
    amountCents: 12345,
    backUrl: 'https://pontodopedido.com/portal',
  };

  it('monta a cobrança mensal e a anual em reais, em BRL', () => {
    const monthly = buildPreapprovalBody({ ...base, period: 'monthly' });
    expect(monthly.auto_recurring).toEqual({
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: 123.45,
      currency_id: 'BRL',
    });
    expect(monthly.external_reference).toBe(base.subscriptionId);
    expect(monthly.status).toBe('pending');
    expect(buildPreapprovalBody({ ...base, period: 'yearly' }).auto_recurring.frequency).toBe(12);
  });
});

describe('notificações', () => {
  it('só consulta os tópicos de assinatura e recusa ids suspeitos', () => {
    expect(webhookTarget('subscription_preapproval', 'abc123')).toEqual({
      kind: 'preapproval',
      path: '/preapproval/abc123',
      key: 'preapproval:abc123',
    });
    expect(webhookTarget('subscription_authorized_payment', '99')?.path).toBe('/authorized_payments/99');
    expect(webhookTarget('payment', '99')).toBeNull();
    expect(webhookTarget('subscription_preapproval', '../../etc')).toBeNull();
    expect(webhookTarget('subscription_preapproval', null)).toBeNull();
  });

  it('a chave do evento muda com o estado, para tratar cada mudança uma vez', () => {
    const target = webhookTarget('subscription_authorized_payment', '99')!;
    expect(eventKey(target, { status: 'processed', payment: { status: 'approved' } })).not.toBe(
      eventKey(target, { status: 'recycling' }),
    );
  });
});
