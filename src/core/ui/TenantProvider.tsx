'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { VisualModel } from '@/core/apps';

// Contexto mínimo do restaurante para componentes de cliente.
export type ClientTenant = {
  tenantId: string;
  slug: string;
  base: string;
  timezone: string;
  model: VisualModel;
  permissions: Record<string, 'direct' | 'approval'>;
  userId: string;
  isOwner: boolean;
};

const Ctx = createContext<ClientTenant | null>(null);

export function TenantProvider({ value, children }: { value: ClientTenant; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTenant(): ClientTenant {
  const value = useContext(Ctx);
  if (!value) throw new Error('useTenant fora do TenantProvider');
  return value;
}

export function usePermission(code: string): 'direct' | 'approval' | 'deny' {
  return useTenant().permissions[code] ?? 'deny';
}

export function useHref() {
  const { base } = useTenant();
  return (path: string) => `${base}${path}`;
}
