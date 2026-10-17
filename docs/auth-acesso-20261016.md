# Cadastro, recuperação e segurança da conta — 16/10/2026

Complementa os relatórios anteriores, sem substituir suas evidências. Escopo: Auth do aplicativo `qmhtzosfbosgolevnybd`. Billing central, Mercado Pago, preços, licenças, RLS e templates hospedados não foram alterados.

## Correções publicadas

- `47e04d2`: cadastro repetido recebe a mesma orientação neutra do cadastro sujeito a confirmação. A interface não afirma que houve envio nem revela existência de conta; oferece entrada e recuperação.
- `2f258fa`: recuperação por `resetPasswordForEmail`, callback `/auth/recuperar`, formulário `/nova-senha`, confirmação da senha e retorno ao login. A escrita exige usuário validado e claims verificadas pelo SDK, issuer do projeto correto, sessão vigente e método `recovery` recente. Sessão comum não basta. Links inválidos não liberam o formulário; parâmetros de destino não permitem redirecionamento externo.
- `2f258fa`: `/portal/seguranca` permite solicitar novo e-mail via `updateUser`, exige sessão e senha atual, mostra alteração pendente e orienta confirmação nas duas caixas. Receber o primeiro callback não significa que a troca terminou. O endereço atual continua exibido até o Auth confirmar a mudança.
- `0061a56`: integração de navegador com Auth real e SMTP Mailpit exclusivamente locais, para recuperação completa e confirmação dupla, sem envio externo nem fixtures em produção.
- `a86049d`: seletores distinguem alertas de produto do anunciador do Next.js; teste financeiro consulta a data do restaurante, como o lançamento real, em vez da data UTC da conexão. Nenhuma regra financeira foi modificada.
- `f57aa51`: o teste volta a preencher os dois campos de senha após a validação negativa, pois a Server Action limpa os campos não controlados. A primeira execução encontrou essa falha de preparação do teste; não foi ignorada.
- `8c5cce6`: distingue no teste o aviso de solicitação recebida do aviso de endereço pendente. A execução anterior comprovou recuperação, troca de senha e novo login nas duas larguras antes dessa asserção ambígua.

Tokens, senhas e links recebidos não são incluídos neste relatório. Os testes de mensagens locais desabilitam traces, vídeos e screenshots.

- `7980be6`: a confirmação obrigatória foi habilitada **somente no arquivo da stack local**, pois o Auth ignora a exigência do segundo link quando `Autoconfirm` está ligado. O SMTP local Mailpit comporta a suíte sem envio externo. O seed confirma exclusivamente seu próprio usuário local por API administrativa, com bloqueio de URLs remotas; os testes de segurança percorrem os links reais de ambos os e-mails locais. Nenhuma configuração Auth hospedada foi alterada. A CI executa primeiro estes dois casos para detectar regressões antes da suíte completa.

## Evidência remota

Produção: https://pontodopedido.vercel.app/ — Chromium, larguras 390 e 1440 px.

| Cenário | Resultado | Evidência |
| --- | --- | --- |
| Cadastro com endereço autorizado já existente | APROVADO | Orientação neutra, sem promessa de envio e com ações de entrada/recuperação. |
| Login e acesso ao Portal | APROVADO | Login real da identidade autorizada nos dois tamanhos; acesso à área de segurança. |
| Recuperação solicitada | APROVADO para solicitação | Formulário submetido uma vez para a caixa autorizada; resposta neutra. Consulta somente leitura confirmou `recovery_sent_at` recente no Auth, sem alteração de e-mail pendente. Não comprova entrega à caixa de entrada. |
| Recuperação concluída por e-mail real | NÃO TESTADO | Depende do recebimento e abertura do e-mail pela identidade autorizada. Senha de produção preservada. |
| Link de recuperação inválido | APROVADO | Callback retorna à recuperação; não libera alteração nem propaga token ao destino. |
| Sessão comum acessando nova senha | APROVADO | Formulário de alteração indisponível. |
| Área de segurança sem sessão | APROVADO | Após sair, acesso exige login. |
| Alteração para o mesmo e-mail | APROVADO | Solicitação rejeitada com orientação para informar endereço diferente. |
| Troca real para outro endereço | NÃO TESTADO | O segundo endereço informado foi o mesmo da conta atual; falta uma segunda caixa autorizada diferente. |
| Responsividade | APROVADO | Sem rolagem horizontal nas telas percorridas em 390/1440 px. |

Os dois testes automatizados públicos de recuperação também passaram contra a produção. Testes unitários usam mocks apenas para casos de unidade; não são apresentados como comprovação remota.

## Configuração externa e dependências humanas

A verificação pública do Supabase passou a redirecionar ao domínio oficial; destino externo não autorizado foi recusado em favor do domínio oficial. Essa configuração foi realizada fora desta execução: não reivindicamos alteração do Dashboard. Nenhum template hospedado de recuperação foi substituído. Código no GitHub não publica templates do Supabase.

Para concluir as provas remotas: abrir a mensagem de recuperação na caixa autorizada e usar um segundo endereço autorizado diferente para testar confirmação dupla. Não enviar senhas, JWTs ou links de confirmação ao relatório.

## Qualidade e publicação

CI aprovada no commit `7980be6ef2e399dcdde80ca3879c695856ff14f0`: [execução 38997015635](https://github.com/aruanmf446-hub/ponto_do_pedido/actions/runs/38997015635).

- Lint, TypeScript e build: aprovados localmente e na CI.
- Unitários: 104 aprovados, 18 arquivos.
- Banco: 59 aprovados, contra as duas instâncias locais na CI.
- E2E: 36 aprovados; 7 cenários exclusivos de produção ignorados intencionalmente na stack local. Os dois casos novos também passaram em uma etapa antecipada (sem contar como casos adicionais).
- Produção: 2 E2E públicos de recuperação aprovados, além do percurso autenticado privado descrito acima. Nenhum mock substitui essa evidência.

A suíte SMTP local comprovou: recuperação recebida, callback válido, senha divergente recusada, senha alterada, retorno ao login, entrada com a nova senha, sessão comum impedida de recuperar, endereço pendente preservado após o primeiro link, mudança concluída somente após o segundo e Portal com o endereço confirmado. Fixtures são excluídas exclusivamente por seu próprio ID local.

As falhas intermediárias foram corrigidas: data UTC no teste financeiro, seletores ambíguos, campos de senha limpos após validação e configuração local com autoconfirmação incompatível com a prova de confirmação dupla. Não foram atribuídas genericamente à infraestrutura nem declaradas aprovadas antes da repetição.

Todos os commits foram enviados diretamente à `main`. O commit documental final preserva o código validado pela execução acima. A Vercel deve estar `READY`, com alias `pontodopedido.vercel.app`, no SHA final da `main`; essa associação é conferida após o push documental.
