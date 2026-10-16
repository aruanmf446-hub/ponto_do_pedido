# Confirmação de e-mail — Ponto do Pedido

Template preparado: [confirmation.html](../backend/app/supabase/templates/confirmation.html).
Assunto: **Confirme seu e-mail — Ponto do Pedido**.

É um template HTML em português, responsivo, sem scripts, imagens remotas ou
rastreamento. O remetente visual é Ponto do Pedido / CRM PLUS. A identidade real
de envio depende do SMTP/remetente verificado configurado no Supabase; o HTML não
altera SMTP nem autoriza usar um domínio de e-mail sem comprovar propriedade.

## Publicação manual no projeto correto

**GitHub, push na main e deploy Vercel não publicam templates no Supabase hospedado.**
A configuração em `backend/app/supabase/config.toml` usa o arquivo somente na stack
local e não muda o Dashboard nem a confirmação obrigatória de produção. A configuração
local de confirmações existente, usada pelo CI, não foi alterada.

No projeto **pontodopedido**, ref `qmhtzosfbosgolevnybd`, abrir
[Authentication → Email Templates → Confirm signup](https://supabase.com/dashboard/project/qmhtzosfbosgolevnybd/auth/templates).
Copiar o assunto acima e o conteúdo completo do HTML, preservando as variáveis,
e salvar. Não aplicar este branding ao Auth do billing central `assinaturas`.
Manter **Confirm email** habilitado no aplicativo.

Antes de enviar um novo e-mail, conferir
[URL Configuration](https://supabase.com/dashboard/project/qmhtzosfbosgolevnybd/auth/url-configuration):

- Site URL: `https://pontodopedido.vercel.app`
- Redirect URL autorizada: `https://pontodopedido.vercel.app/**`

O erro de retorno para localhost não é corrigido pelo HTML. Precisa desse ajuste
remoto separado. Não alterar o domínio global do billing para o Ponto do Pedido.

## Variável oficial e callback preservado

Os dois links usam **`{{ .ConfirmationURL }}`**, gerado pelo Supabase. Não trocar
por uma URL fixa de login ou Portal, por `{{ .RedirectTo }}` isoladamente, nem
montar manualmente uma URL com token. O destino passado pelo cadastro continua
`/auth/confirm?next=...`, validado pela allowlist do Auth. O handler atual mantém
verificação de código/hash, proteção do destino e continuação por login se faltar
o verifier PKCE em outro navegador. Nenhuma alteração foi feita nesse callback.

`ConfirmationURL` já incorpora a verificação e o redirecionamento do Supabase.
As variáveis oficiais `SiteURL`, `RedirectTo`, `Token` e `TokenHash` existem, mas
não precisam ser adicionadas a este template. Não há motivo para mostrar OTP,
hash, JWT ou qualquer secret no corpo, capturas, relatórios ou logs.

Referência oficial consultada: [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates).

## Homologação após salvar no Dashboard

Usar somente identidade autorizada e caixa de entrada acessível. Conferir assunto,
remetente, texto e botão no celular/desktop; abrir a confirmação no navegador do
cadastro e conferir retorno ao domínio oficial. Em outro navegador, respeitar a
continuação por login. Link expirado/inválido não deve criar sessão. Verificar
que confirmar e-mail não cria assinatura ou libera licença. Não copiar o link
recebido para logs, screenshots compartilhadas ou documentação.

**Estado desta entrega: preparado e testado como HTML; não publicado no Dashboard,
nem declarado entregue por e-mail.** O conector disponível não edita Auth config/templates.
