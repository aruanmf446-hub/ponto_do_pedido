import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

// Pagamento por Mercado Pago no projeto assinaturas. Tudo roda dentro de uma
// transação revertida: configuração do provedor e preços de teste não vazam.
const pool = new pg.Pool({
  connectionString: process.env.PDP_TEST_BILLING_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres',
  max: 2,
});
afterAll(() => pool.end());

type Json = Record<string, unknown>;

async function withTx<T>(
  fn: (
    run: (sql: string, params?: unknown[]) => Promise<pg.QueryResultRow[]>,
    fails: (sql: string, params?: unknown[]) => Promise<string>,
  ) => Promise<T>,
) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const run = async (sql: string, params: unknown[] = []) => (await c.query(sql, params)).rows;
    const fails = async (sql: string, params: unknown[] = []) => {
      await c.query('savepoint s');
      try {
        await c.query(sql, params);
        return 'NO_ERROR';
      } catch (e) {
        const err = e as { detail?: string; code?: string };
        return err.detail ?? err.code ?? 'UNKNOWN';
      } finally {
        await c.query('rollback to savepoint s');
      }
    };
    return await fn(run, fails);
  } finally {
    await c.query('rollback');
    c.release();
  }
}

const slug = () => `p${randomUUID().replace(/-/g, '').slice(0, 10)}`;

describe('pagamento online (Mercado Pago)', () => {
  it('fluxo completo: contratar, iniciar, aprovar, falhar, cancelar, com idempotência', async () => {
    await withTx(async (run, fails) => {
      const identity = randomUUID();
      const subscribe = async () =>
        (
          await run(
            `select public.billing_subscribe($1, 'dono@teste.local', 'Dono', 'start', 'Restaurante', $2, 'vitest', $3) as r`,
            [identity, slug(), randomUUID()],
          )
        )[0]!.r as { subscription_id: string; status: string };

      // Sem provedor habilitado, nada de pagamento e a renovação manual segue valendo.
      expect(await fails(`select public.billing_payment_context($1, $2)`, [identity, randomUUID()])).toBe('PAYMENT_DISABLED');

      await run(`update public.platform_settings set value = '"mercadopago"' where key = 'payment_provider'`);
      await run(`update public.platform_settings set value = '"on_payment"' where key = 'activation_mode'`);

      const { subscription_id: sub, status } = await subscribe();
      expect(status).toBe('pending_payment');

      // Plano sem preço definido: não inicia cobrança.
      expect(await fails(`select public.billing_payment_context($1, $2)`, [identity, sub])).toBe('PRICE_UNDEFINED');

      // Só para o teste (revertido ao fim): preço fictício.
      await run(`update public.plans set price_cents = 1000 where code = 'start'`);
      const ctx = (await run(`select public.billing_payment_context($1, $2) as c`, [identity, sub]))[0]!.c as Json;
      expect(ctx.amount_cents).toBe(1000);
      expect(ctx.checkout_url).toBeNull();

      await run(`select public.billing_payment_started($1, 'prea-1', 'https://mp.test/checkout/prea-1')`, [sub]);
      const again = (await run(`select public.billing_payment_context($1, $2) as c`, [identity, sub]))[0]!.c as Json;
      expect(again.checkout_url).toBe('https://mp.test/checkout/prea-1');

      // Assinatura autorizada: ainda não ativa (ativa só quando a cobrança é aprovada).
      await run(`select public.billing_apply_mercadopago('preapproval:prea-1:authorized:', 'preapproval', $1::jsonb)`, [
        JSON.stringify({
          id: 'prea-1',
          status: 'authorized',
          external_reference: sub,
          next_payment_date: '2026-11-16T10:00:00.000-03:00',
        }),
      ]);
      expect((await run(`select status::text as s from public.subscriptions where id = $1`, [sub]))[0]!.s).toBe(
        'pending_payment',
      );

      // Cobrança de outra moeda ou valor nunca ativa a licença.
      const underpaid = (
        await run(
          `select public.billing_apply_mercadopago('authorized_payment:underpaid:processed:approved', 'authorized_payment', $1::jsonb) as r`,
          [
            JSON.stringify({
              id: 'underpaid',
              preapproval_id: 'prea-1',
              status: 'processed',
              currency_id: 'BRL',
              transaction_amount: 1,
              payment: { id: 'pay-underpaid', status: 'approved' },
            }),
          ],
        )
      )[0]!.r as Json;
      expect(underpaid.reason).toBe('PAYMENT_AMOUNT_MISMATCH');
      expect((await run(`select status::text as s from public.subscriptions where id = $1`, [sub]))[0]!.s).toBe(
        'pending_payment',
      );

      const wrongCurrency = (
        await run(
          `select public.billing_apply_mercadopago('authorized_payment:usd:processed:approved', 'authorized_payment', $1::jsonb) as r`,
          [
            JSON.stringify({
              id: 'usd',
              preapproval_id: 'prea-1',
              status: 'processed',
              currency_id: 'USD',
              transaction_amount: 10,
              payment: { id: 'pay-usd', status: 'approved' },
            }),
          ],
        )
      )[0]!.r as Json;
      expect(wrongCurrency.reason).toBe('PAYMENT_AMOUNT_MISMATCH');

      const unrelated = (
        await run(`select public.billing_apply_mercadopago('preapproval:other:authorized:', 'preapproval', $1::jsonb) as r`, [
          JSON.stringify({ id: 'other', status: 'authorized', external_reference: sub }),
        ])
      )[0]!.r as Json;
      expect(unrelated.ignored).toBe(true);
      expect((await run(`select provider_subscription_id as id from public.subscriptions where id = $1`, [sub]))[0]!.id).toBe(
        'prea-1',
      );

      // Cobrança aprovada: ativa, fatura paga, período definido.
      const approved = {
        id: 'ap-1',
        preapproval_id: 'prea-1',
        status: 'processed',
        payment: { id: 'pay-1', status: 'approved' },
        currency_id: 'BRL',
        transaction_amount: 10,
      };
      const first = (
        await run(
          `select public.billing_apply_mercadopago('authorized_payment:ap-1:processed:approved', 'authorized_payment', $1::jsonb) as r`,
          [JSON.stringify(approved)],
        )
      )[0]!.r as Json;
      expect(first.status).toBe('active');
      const row = (
        await run(
          `select status::text as s, current_period_end > now() + interval '27 days' as long from public.subscriptions where id = $1`,
          [sub],
        )
      )[0];
      expect(row).toEqual({ s: 'active', long: true });
      const invoices = await run(
        `select status::text as s, amount_cents::int as a, provider_reference as r from public.invoices where subscription_id = $1`,
        [sub],
      );
      expect(invoices).toEqual([{ s: 'paid', a: 1000, r: 'pay-1' }]);

      // Notificação repetida e outro evento do mesmo pagamento não duplicam nada.
      const dup = (
        await run(
          `select public.billing_apply_mercadopago('authorized_payment:ap-1:processed:approved', 'authorized_payment', $1::jsonb) as r`,
          [JSON.stringify(approved)],
        )
      )[0]!.r as Json;
      expect(dup.duplicate).toBe(true);
      const other = (
        await run(
          `select public.billing_apply_mercadopago('authorized_payment:ap-1:scheduled:approved', 'authorized_payment', $1::jsonb) as r`,
          [JSON.stringify(approved)],
        )
      )[0]!.r as Json;
      expect(other.duplicate).toBe(true);
      expect((await run(`select count(*)::int as n from public.invoices where subscription_id = $1`, [sub]))[0]!.n).toBe(1);

      // Cobrança recusada pelo provedor: pagamento pendente.
      await run(
        `select public.billing_apply_mercadopago('authorized_payment:ap-2:recycling:', 'authorized_payment', $1::jsonb)`,
        [
          JSON.stringify({
            id: 'ap-2',
            preapproval_id: 'prea-1',
            status: 'recycling',
            payment: { id: 'pay-2', status: 'rejected' },
            transaction_amount: 10,
          }),
        ],
      );
      expect((await run(`select status::text as s from public.subscriptions where id = $1`, [sub]))[0]!.s).toBe('past_due');

      // Nova cobrança aprovada: volta a ativa e estende o período.
      await run(
        `select public.billing_apply_mercadopago('authorized_payment:ap-3:processed:approved', 'authorized_payment', $1::jsonb)`,
        [
          JSON.stringify({
            id: 'ap-3',
            preapproval_id: 'prea-1',
            status: 'processed',
            payment: { id: 'pay-3', status: 'approved' },
            currency_id: 'BRL',
            transaction_amount: 10,
          }),
        ],
      );
      expect((await run(`select status::text as s from public.subscriptions where id = $1`, [sub]))[0]!.s).toBe('active');
      expect(
        (await run(`select count(*)::int as n from public.invoices where subscription_id = $1 and status = 'paid'`, [sub]))[0]!.n,
      ).toBe(2);

      // Cancelamento no provedor agenda o fim do período.
      await run(`select public.billing_apply_mercadopago('preapproval:prea-1:cancelled:', 'preapproval', $1::jsonb)`, [
        JSON.stringify({ id: 'prea-1', status: 'cancelled', external_reference: sub }),
      ]);
      expect((await run(`select cancel_at_period_end as c from public.subscriptions where id = $1`, [sub]))[0]!.c).toBe(true);

      // Com provedor ligado, renovar e trocar de plano não estendem nada de graça.
      expect(await fails(`select public.billing_renew($1, $2)`, [identity, sub])).toBe('PAYMENT_REQUIRED');
      expect(await fails(`select public.billing_change_plan($1, $2, 'plus')`, [identity, sub])).toBe('PAYMENT_REQUIRED');

      // Recurso de outra assinatura/inexistente é registrado e ignorado.
      const ghost = (
        await run(`select public.billing_apply_mercadopago('preapproval:x:authorized:', 'preapproval', $1::jsonb) as r`, [
          JSON.stringify({ id: 'x', status: 'authorized', external_reference: randomUUID() }),
        ])
      )[0]!.r as Json;
      expect(ghost.ignored).toBe(true);
      expect((await run(`select error from public.payment_events where event_key = 'preapproval:x:authorized:'`))[0]!.error).toBe(
        'Assinatura não encontrada.',
      );
    });
  });

  it('ligar o provedor basta para exigir pagamento: não ativa na contratação', async () => {
    await withTx(async (run) => {
      // activation_mode continua 'immediate' de propósito.
      await run(`update public.platform_settings set value = '"mercadopago"' where key = 'payment_provider'`);
      const r = (
        await run(
          `select public.billing_subscribe($1, 'dono@teste.local', 'Dono', 'start', 'Restaurante', $2, 'vitest', $3) as r`,
          [randomUUID(), slug(), randomUUID()],
        )
      )[0]!.r as { status: string };
      expect(r.status).toBe('pending_payment');
    });
  });

  it('navegador e usuário logado não executam as funções de pagamento', async () => {
    await withTx(async (run, fails) => {
      for (const role of ['anon', 'authenticated']) {
        await run(`set local role ${role}`);
        expect(await fails(`select public.billing_apply_mercadopago('k', 'preapproval', '{}'::jsonb)`)).toBe('42501');
        expect(await fails(`select public.billing_payment_started(gen_random_uuid(), 'x', 'https://x')`)).toBe('42501');
        expect(await fails(`select * from public.payment_events`)).toBe('42501');
        await run(`reset role`);
      }
    });
  });
});
