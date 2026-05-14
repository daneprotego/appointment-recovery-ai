import { NextResponse, type NextRequest } from 'next/server';

import { createListHandler } from '@/lib/api/resource-handlers';
import { requireApiAuth } from '@/lib/auth/api';

const resource = { tableName: 'businesses' as const, businessScopeColumn: 'id' as const };

export const GET = createListHandler(resource);

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['owner']);

  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json(
    {
      error: 'Forbidden',
      message: 'Businesses are created during Supabase signup so ownership can be linked atomically.',
    },
    { status: 403 },
  );
}
