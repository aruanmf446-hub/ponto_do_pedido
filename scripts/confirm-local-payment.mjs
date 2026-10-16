// Fixture exclusiva das stacks locais: confirma o evento no banco, sem API ou cobrança real.
import pg from 'pg';
export async function confirmLocalPayment(subscriptionId, appUrl, billingUrl) {
  for (const url of [appUrl, billingUrl]) {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
      throw new Error('Fixture de pagamento proibida fora das stacks locais.');
    }
  }
  if (new URL(billingUrl).port !== '55321') throw new Error('Porta local de billing inesperada.');
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:55322/postgres' });
  await client.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `select s.account_id, p.price_cents from public.subscriptions s
      join public.plans p on p.code = s.plan_code where s.id = $1`,
      [subscriptionId],
    );
    if (!rows[0]?.price_cents) throw new Error('Preço local não definido.');
    const previous = await client.query("select value from public.platform_settings where key = 'payment_provider' for update");
    await client.query(`update public.platform_settings set value = '"mercadopago"' where key = 'payment_provider'`);
    const reference = `local-${subscriptionId}`;
    await client.query('select public.billing_payment_started($1,$2,$3)', [
      subscriptionId,
      reference,
      'https://example.invalid/local-test',
    ]);
    await client.query("select public.billing_apply_mercadopago($1,'authorized_payment',$2::jsonb)", [
      reference,
      JSON.stringify({
        id: reference,
        preapproval_id: reference,
        status: 'processed',
        currency_id: 'BRL',
        transaction_amount: Number(rows[0].price_cents) / 100,
        payment: { id: reference, status: 'approved' },
      }),
    ]);
    const verified = await client.query(`select s.status = 'active' and exists (
      select 1 from public.invoices i where i.subscription_id = s.id and i.status = 'paid'
      and i.amount_cents = p.price_cents) as confirmed
      from public.subscriptions s join public.plans p on p.code = s.plan_code where s.id=$1`, [subscriptionId]);
    if (verified.rows[0]?.confirmed !== true) throw new Error('Evento local não confirmou assinatura e fatura.');
    await client.query("update public.platform_settings set value = $1::jsonb where key = 'payment_provider'", [
      JSON.stringify(previous.rows[0].value),
    ]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}
