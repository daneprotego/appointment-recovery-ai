import { NextResponse, type NextRequest } from 'next/server';

import type { UserRole } from '@/lib/types/database';

export interface ApiAuthContext {
  businessId: string;
  userId: string;
  role: UserRole;
}

export type ApiAuthResult =
  | { ok: true; context: ApiAuthContext }
  | { ok: false; response: NextResponse };

export function requireApiAuth(request: NextRequest): ApiAuthResult {
  const businessId = request.headers.get('x-business-id');
  const userId = request.headers.get('x-user-id');
  const role = (request.headers.get('x-user-role') ?? 'staff') as UserRole;

  if (!businessId || !userId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Placeholder auth requires x-business-id and x-user-id headers until Supabase Auth is wired.',
        },
        { status: 401 },
      ),
    };
  }

  return {
    ok: true,
    context: {
      businessId,
      userId,
      role,
    },
  };
}
