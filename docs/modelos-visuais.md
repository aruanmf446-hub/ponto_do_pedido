# Modelos visuais

Cada aplicativo interno tem quatro modelos que mudam **estrutura, composição e tipografia**
(não apenas cores). A escolha fica em `ui_preferences` (usuário + restaurante + aplicativo) e não
altera dados nem permissões. Esquema claro/escuro/automático por aplicativo.

| Aplicativo | m1 | m2 | m3 | m4 |
| --- | --- | --- | --- | --- |
| Gestão | Centro de Comando Corporativo | Workspace Editorial Refinado | Suíte Administrativa Empresarial | Sala de Controle Operacional |
| Atendimento | Menu Online | Mapa do Salão | Comanda em Foco | Estação Premium |
| Caixa | Minimalista Elegante | Terminal Dark | Touch Moderno | Clássico Profissional |
| Cozinha | Kanban de Pedidos | Produção em Fila | Estações de Preparo | Comando Minimalista |
| Administrativo e Financeiro | Painel Financeiro Executivo | Agenda Financeira | Escritório Contábil por Documentos | Console de Aprovações e Pagamentos |
| Estoque | Controle de Estoque Industrial | Lotes e Validade | Conferência e Inventário | Solicitações e Movimentações |

O seletor (`ModelPicker`, botão "Modelo N/4") abre uma galeria com miniatura, nome e descrição de
cada modelo (`TemplateGallery` + `ModelThumb`).

## Canais públicos

| Canal | m1 | m2 | m3 | m4 | Quem escolhe |
| --- | --- | --- | --- | --- | --- |
| Cardápio Digital | Cardápio QR Elegante | Vitrine Vibrante | Experiência Premium | Pedido Rápido Moderno | Restaurante, em Gestão → Operação (`cardapio_template`) |
| Delivery | Delivery Elegante | Delivery Vibrante | Delivery Premium | Pedido Rápido | Restaurante, em Gestão → Operação (`delivery_template`) |
| Site institucional | Institucional Clássico | Vitrine de Aplicativos | Editorial Gastronômico | Conversão Direta | Titular da plataforma, variável `PDP_SITE_TEMPLATE` |

- Cardápio e Delivery: o modelo fica em `tenants.settings` (autorizado por `cardapio.configurar` e
  `delivery.configurar`) e é lido por `public_templates(slug)`. O cliente final escolhe apenas claro/escuro.
  Padrões: Cardápio `m1`, Delivery `m2`.
- Site: `/modelos` mostra os quatro; `/?modelo=mN` abre a prévia de qualquer um.

## Imagens

Nenhuma imagem externa é usada. Produtos sem foto recebem ilustrações próprias (`FoodArt`), inferidas
pelo nome do produto/categoria e válidas para qualquer tipo de cozinha (pratos, lanches, japonesa,
massas, saladas, cafés, sobremesas, açaí, bebidas etc.). Ícones vêm do `lucide-react` (`Icon`).

Implementação: o Shell do aplicativo renderiza estruturas diferentes por modelo e define
`data-model`/`data-scheme` (`data-template` nos canais públicos); o CSS é prefixado por aplicativo
(`gs-`, `at-`, `cx-`, `kz-`, `fn-`, `es-`, `cd-`, `dl-`, `pl-`, `ac-`).
