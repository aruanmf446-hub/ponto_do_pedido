import type { Metadata } from 'next';
import { PlanCards } from '@/apps/plataforma/Landing';
import { MODULES } from '@/apps/plataforma/content';
import { fetchPlans } from '@/core/billing';

export const metadata: Metadata = {
  title: 'Planos',
  description: 'Compare os planos do Ponto do Pedido e os aplicativos incluídos em cada um.',
};

export default async function PlansPage() {
  const plans = await fetchPlans();
  return (
    <section className="pl-section">
      <p className="pl-eyebrow">Planos</p>
      <h1 className="pl-h2">Escolha os aplicativos da sua operação.</h1>
      {plans.length === 0 ? (
        <p className="pl-muted">Os planos estão temporariamente indisponíveis. Tente novamente em instantes.</p>
      ) : (
        <>
          <PlanCards plans={plans} />
          <h2 className="pl-h2" style={{ marginTop: 72 }}>
            Comparativo
          </h2>
          <div className="pl-table-wrap">
            <table className="pl-table">
              <thead>
                <tr>
                  <th scope="col">Aplicativo</th>
                  {plans.map((p) => (
                    <th key={p.code} scope="col" className="c">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m.id}>
                    <th scope="row">{m.name}</th>
                    {plans.map((p) => (
                      <td key={p.code} className="c">
                        {p.modules.includes(m.id) ? <span aria-label="Incluído">●</span> : <span aria-label="Não incluído">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
