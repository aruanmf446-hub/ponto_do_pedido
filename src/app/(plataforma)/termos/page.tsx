import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Termos de uso' };

export default function TermsPage() {
  return (
    <article className="pl-narrow pl-legal" style={{ maxWidth: 760 }}>
      <p className="pl-eyebrow">Versão 2026-10</p>
      <h1 style={{ fontSize: '2.2rem' }}>Termos de uso</h1>
      <h2>1. Titularidade</h2>
      <p>
        A assinatura pertence ao titular que a contrata. O titular controla a estrutura de autoridade do estabelecimento, nomeia
        gestores e colaboradores e define permissões, limites e aprovações.
      </p>
      <h2>2. Dados do estabelecimento</h2>
      <p>
        Os dados operacionais de cada restaurante são isolados e acessíveis apenas por usuários vinculados e autorizados. Dados
        comerciais da assinatura são mantidos separadamente dos dados operacionais.
      </p>
      <h2>3. Cobrança</h2>
      <p>
        Valores e condições comerciais são informados pela equipe comercial do Ponto do Pedido. Enquanto nenhum meio de pagamento
        estiver configurado na plataforma, nenhuma cobrança automática é realizada e as faturas permanecem registradas para
        acompanhamento.
      </p>
      <h2>4. Cancelamento</h2>
      <p>
        O cancelamento é efetivado ao fim do período vigente. Até essa data, o titular pode desistir do cancelamento e o
        restaurante continua operando normalmente.
      </p>
      <h2>5. Sistemas externos</h2>
      <p>
        O Ponto do Pedido não integra ERPs externos. O titular pode indicar, por processo, que determinada atividade é realizada
        em outro sistema; nesse caso a função interna correspondente fica desativada, sem sincronização de dados.
      </p>
    </article>
  );
}
