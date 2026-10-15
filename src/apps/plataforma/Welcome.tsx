'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { APP_LABELS, type AppModule } from '@/core/apps';
import { tenantUrl } from '@/core/tenant/urls';
import { finishOnboarding, markOnboarding } from '@/apps/plataforma/actions';

export type OnboardingState = {
  completed_at: string | null;
  modules: string[];
  manual: Record<string, 'pending' | 'done' | 'skipped'>;
  detected: Record<string, boolean>;
};

type Step = { key: string; title: string; text: string; path: string; module?: AppModule; optional?: boolean };

// O assistente não duplica formulários: cada etapa abre a função correspondente na Gestão.
const STEPS: Step[] = [
  { key: 'restaurante', title: 'Dados do estabelecimento', text: 'Nome, contato, endereço, logo e fuso horário.', path: '/gestao/restaurante' },
  { key: 'equipe', title: 'Colaboradores e gestores', text: 'Cadastre quem vai operar. Pode ficar para depois.', path: '/gestao/equipe', optional: true },
  { key: 'permissoes', title: 'Funções e permissões', text: 'Defina responsabilidades, limites e aprovações.', path: '/gestao/funcoes', optional: true },
  { key: 'mesas', title: 'Mesas e setores', text: 'Salão, áreas e mesas com QR Code próprio.', path: '/gestao/mesas' },
  { key: 'horarios', title: 'Horários de funcionamento', text: 'Usados pelo cardápio e pelo delivery.', path: '/gestao/restaurante#horarios' },
  { key: 'cardapio', title: 'Categorias e produtos', text: 'Fotos, descrições e preços.', path: '/gestao/cardapio' },
  { key: 'pagamentos', title: 'Formas de pagamento e taxas', text: 'Métodos aceitos e taxa de serviço.', path: '/gestao/pagamentos' },
  { key: 'cardapio_local', title: 'Cardápio Digital Local', text: 'Quem pode fazer pedidos pelo QR Code.', path: '/gestao/operacao#cardapio', module: 'cardapio' },
  { key: 'delivery', title: 'Delivery', text: 'Regiões, taxas e link público.', path: '/gestao/operacao#delivery', module: 'delivery' },
  { key: 'financeiro', title: 'Administrativo e Financeiro', text: 'Fornecedores e processos internos ou em ERP externo.', path: '/gestao/operacao#processos', module: 'financeiro' },
  { key: 'estoque', title: 'Estoque', text: 'Locais de armazenagem ou indicação de ERP externo.', path: '/gestao/operacao#processos', module: 'estoque' },
];

export function Welcome({
  tenantId,
  slug,
  name,
  state,
}: {
  tenantId: string;
  slug: string;
  name: string;
  state: OnboardingState;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const steps = STEPS.filter((s) => !s.module || state.modules.includes(s.module));
  const isDone = (s: Step) => state.detected[s.key] === true || state.manual[s.key] === 'done' || state.manual[s.key] === 'skipped';
  const done = steps.filter(isDone).length;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <div className="pl-wide">
      <p className="pl-eyebrow">Primeiro acesso</p>
      <h1 style={{ fontSize: 'clamp(2rem,4vw,3rem)' }}>Bem-vindo ao Ponto do Pedido.</h1>
      <p className="pl-muted" style={{ maxWidth: '60ch' }}>
        Vamos preparar <strong>{name}</strong>. Cada etapa abre a função correspondente na Gestão do restaurante. Seu progresso fica
        salvo — você pode continuar depois pelo Portal do Assinante.
      </p>

      <section className="pl-card" style={{ marginTop: 24 }} aria-labelledby="apps-contratados">
        <h2 id="apps-contratados" style={{ fontSize: '1.2rem' }}>
          Seus aplicativos
        </h2>
        <ul className="pl-chips">
          {['gestao', ...state.modules.filter((m) => m !== 'gestao')].map((m) => (
            <li key={m}>{APP_LABELS[m as AppModule] ?? m}</li>
          ))}
        </ul>
        <div className="pl-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="pl-muted" style={{ margin: 0 }}>
          {done} de {steps.length} etapas concluídas
        </p>
      </section>

      <ol className="pl-steps" style={{ marginTop: 20 }}>
        {steps.map((s, i) => (
          <li key={s.key} data-done={isDone(s)}>
            <span className="pl-step-dot" aria-hidden="true">
              {isDone(s) ? '✓' : i + 1}
            </span>
            <div>
              <strong>{s.title}</strong>
              <small>
                {s.text}
                {s.optional ? ' (opcional)' : ''}
              </small>
            </div>
            <div className="pl-row">
              <a className="pl-btn pl-btn--small" href={tenantUrl(slug, `${s.path}${s.path.includes('#') ? '' : ''}`)}>
                {isDone(s) ? 'Revisar' : 'Configurar'}
              </a>
              {!isDone(s) && s.optional ? (
                <button
                  type="button"
                  className="pl-btn pl-btn--small pl-btn--ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await markOnboarding(tenantId, s.key, 'skipped');
                      router.refresh();
                    })
                  }
                >
                  Depois
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="pl-row" style={{ marginTop: 28 }}>
        <button
          type="button"
          className="pl-btn"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await finishOnboarding(tenantId);
              router.push('/portal');
            })
          }
        >
          {done === steps.length ? 'Concluir primeiro acesso' : 'Finalizar agora'}
        </button>
        <a className="pl-btn pl-btn--ghost" href="/portal">
          Fazer depois
        </a>
        <a className="pl-btn pl-btn--ghost" href={tenantUrl(slug, '/gestao')}>
          Abrir Gestão
        </a>
      </div>
    </div>
  );
}
