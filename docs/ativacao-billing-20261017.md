# Ativação do billing — 17/10/2026

## Alterações remotas confirmadas

Projeto Supabase comercial `assinaturas`: `bjtlookhgkdltdohzxnq`.

- Aplicada `20261016213840_require_confirmed_payment.sql`. `billing_checkout_policy()` retorna `{"version":1,"requires_payment":true}`.
- Aplicada `20261016222507_central_products.sql`. Produto `ponto_do_pedido` tem Auth registrado exclusivamente em `qmhtzosfbosgolevnybd` e retorno autorizado `https://pontodopedido.vercel.app/portal`.
- `payment_provider` alterado de `null` para `mercadopago` após verificar política obrigatória, produto, origem Auth, retorno e três planos ativos com preço mensal positivo.
- Histórico de migrations remoto conciliado com os números e nomes dos arquivos do repositório, para não reaplicar por engano no próximo `supabase db push`.
- Conferidos RPCs comerciais, leitura de `overview` e inexistência de novas assinaturas, faturas ou eventos financeiros após a intervenção.
- `billing_product_call` executável somente pelo `service_role`, não por `anon` ou `authenticated`.
- Edge Functions `billing` e `mercadopago-webhook` ativas no projeto comercial; `license-sync` ativo no operacional. Chaves `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_BACK_URL` aparecem cadastradas no painel mostrado pelo titular (valores não copiados nem validados por esta intervenção).

## Estado e limites do teste

A configuração comercial agora reconhece `mercadopago` e o checkout deixa de ser bloqueado pela falta das duas migrations ou pelo valor `null` da configuração. O código cliente consulta a Edge Function `checkout_status`, que também exige `MP_ACCESS_TOKEN` em tempo de execução e retorno permitido.

**Ainda não homologado:** credenciais contra API do Mercado Pago com um pagamento real/sandbox, registro dos dois tópicos Webhooks no painel Mercado Pago, assinatura HMAC recebida, confirmação de fatura paga, ativação por webhook e sincronização de licença até a Gestão. Não afirmar fluxo de pagamento 100% testado apenas pela presença dos secrets.

Não foram criadas cobranças, assinaturas nem licenças artificiais. A `activation_mode=immediate` legada permanece preservada, mas `billing_subscribe` agora sempre registra `pending_payment` — a licença exige evento de pagamento aprovado.

## Revalidação necessária

1. Logar no portal e abrir `/contratar`: confirmar botão habilitado (Edge Function consulta as credenciais).
2. Conferir no Mercado Pago, sem expor segredos, que a integração tem Webhooks de `subscription_preapproval` e `subscription_authorized_payment` apontando para `https://bjtlookhgkdltdohzxnq.supabase.co/functions/v1/mercadopago-webhook`.
3. Homologar transação de teste e comprovar criação de `subscription_events`, fatura `paid`, licença sincronizada em `pontodopedido` e acesso ao restaurante. Evitar uma transação real antes dessa homologação.

Esta alteração foi feita no banco remoto, sem redefinir valores dos planos ou alterar o Auth do produto.
