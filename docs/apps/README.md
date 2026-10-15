# Aplicativos

| App | Pasta | Função principal |
| --- | --- | --- |
| Site e Portal do Assinante | `src/apps/plataforma` | apresentação, planos, cadastro, contratação, assinaturas e assistente inicial |
| Acesso | `src/apps/acesso` | login do restaurante, recuperação e troca de senha |
| Gestão | `src/apps/gestao` | indicadores, restaurante, equipe, funções e permissões, aprovações, mesas e QR, produtos, pagamentos, configurações (inclui responsabilidade ERP por processo), histórico, licenças |
| Atendimento | `src/apps/atendimento` | salão, comandas, pedidos, transferência, conta, pagamento no atendimento, balcão |
| Caixa | `src/apps/caixa` | abertura, recebimento (divisão, troco, desconto e estorno com aprovação), sangria/suprimento, fechamento com divergência, histórico e comprovante |
| Cozinha | `src/apps/cozinha` | Kanban de produção por etapas, indisponibilidade de itens, solicitação de materiais |
| Cardápio Digital | `src/apps/cardapio` | cardápio público e pedido por QR da mesa (chave do dispositivo) |
| Delivery | `src/apps/delivery` | vitrine, pedido, rastreio público e Central de Delivery da equipe |
| Administrativo e Financeiro | `src/apps/financeiro` | compras (solicitação→cotação→aprovação→pedido→recebimento), fornecedores, contas a pagar/receber, documentos, orçamentos, reembolsos, fluxo e conciliação, suprimentos |
| Estoque | `src/apps/estoque` | saldos, lotes e validade (FEFO), entradas e recebimentos, solicitações, inventário, movimentações, materiais e locais |

Fluxos ponta a ponta cobertos por testes: veja `tests/db` e `tests/e2e`.
