'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import type { ActionFail, ActionResult } from '@/core/errors';

/** Dados para transformar uma ação bloqueada em solicitação de aprovação. */
export type ApprovalSpec = {
  kind: string;
  summary: string;
  amountCents?: number | null;
  payload: Record<string, unknown>;
};

export type PendingApproval = ApprovalSpec & { permission: string };

type RunOptions<T> = {
  approval?: ApprovalSpec;
  onSuccess?: (data: T) => void;
  refresh?: boolean;
};

/**
 * Executa uma Server Action padronizada. Quando o banco responde que a ação
 * exige aprovação, expõe `approval` para o aplicativo oferecer a solicitação.
 */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ActionFail | null>(null);
  const [approval, setApproval] = useState<PendingApproval | null>(null);

  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, options: RunOptions<T> = {}) =>
      new Promise<ActionResult<T>>((resolve) => {
        setError(null);
        startTransition(async () => {
          const result = await fn();
          if (result.ok) {
            options.onSuccess?.(result.data);
            if (options.refresh !== false) router.refresh();
          } else if (result.code === 'APPROVAL_REQUIRED' && options.approval && result.permission) {
            setApproval({ ...options.approval, permission: result.permission });
          } else {
            setError(result);
          }
          resolve(result);
        });
      }),
    [router],
  );

  return {
    run,
    pending,
    error,
    clearError: () => setError(null),
    approval,
    clearApproval: () => setApproval(null),
    /** Abre a solicitação manualmente (ex.: gestor sem poder de delegar pede ao titular). */
    openApproval: (spec: ApprovalSpec, permission: string) => {
      setError(null);
      setApproval({ ...spec, permission });
    },
  };
}

/** Chave de idempotência por intenção do usuário (gerada no clique). */
export function newIdempotencyKey(prefix = 'ui'): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`;
  return `${prefix}${random.replace(/[^a-zA-Z0-9]/g, '')}`;
}
