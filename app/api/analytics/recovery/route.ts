import { NextResponse, type NextRequest } from 'next/server';

import { requireApiAuth } from '@/lib/auth/api';
import { getRecoveryAnalytics } from '@/lib/analytics/recovery';

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const analytics = await getRecoveryAnalytics(auth.context.businessId);
  return NextResponse.json({ data: analytics });
}
