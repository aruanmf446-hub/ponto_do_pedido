# Modelos visuais

Cada aplicativo interno tem quatro modelos que mudam **estrutura, composição e tipografia**
(não apenas cores). A escolha fica em `ui_preferences` (usuário + restaurante + aplicativo) e não
altera dados nem permissões. Esquema claro/escuro/automático por aplicativo.

| Aplicativo | m1 | m2 | m3 | m4 |
| --- | --- | --- | --- | --- |
| Gestão | Centro de Comando | Workspace Editorial | Suíte Empresarial | Sala de Controle |
| Atendimento | Menu Online | Mapa do Salão | Comanda em Foco | Estação Premium |
| Caixa | Minimalista Elegante | Terminal | Touch Moderno | Clássico Profissional |
| Cozinha | Kanban de Pedidos | Fila de Produção | Estações de Preparo | Comando Minimalista |
| Administrativo e Financeiro | Escritório por Documentos | Console de Aprovações | Livro-Razão | Agenda Financeira |
| Estoque | Controle Industrial | Lotes e Validade | Conferência | Solicitações e Movimentos |

Site/Portal, Cardápio Digital e Delivery têm identidade própria com alternância claro/escuro.

Implementação: o Shell do aplicativo renderiza estruturas diferentes por modelo e define
`data-model`/`data-scheme`; o CSS é prefixado por aplicativo (`gs-`, `at-`, `cx-`, `kz-`, `fn-`,
`es-`, `cd-`, `dl-`, `pl-`, `ac-`). O seletor é o componente `ModelPicker` ("Aparência").
