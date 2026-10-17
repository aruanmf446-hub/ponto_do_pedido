import type { NextRequest } from 'next/server';
import { confirmRecovery } from '@/core/auth/confirm';
export function GET(request: NextRequest) {
  return confirmRecovery(request);
}
