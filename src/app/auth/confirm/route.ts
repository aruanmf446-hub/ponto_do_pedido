import type { NextRequest } from 'next/server';
import { confirmEmail } from '@/core/auth/confirm';

export function GET(request: NextRequest) {
  return confirmEmail(request);
}
