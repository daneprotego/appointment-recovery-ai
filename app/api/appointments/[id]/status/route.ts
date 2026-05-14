import { NextResponse, type NextRequest } from 'next/server';

import { requireApiAuth } from '@/lib/auth/api';
import type { AppointmentStatus } from '@/lib/types/database';
import { transitionAppointmentStatus } from '@/lib/workflows/appointment-lifecycle';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAuth(request, ['owner', 'admin', 'staff']);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = (await request.json()) as { status?: AppointmentStatus; reason?: string; recoveryNotes?: string };

  if (!body.status) {
    return NextResponse.json({ error: 'status is required.' }, { status: 400 });
  }

  const result = await transitionAppointmentStatus({
    appointmentId: id,
    businessId: auth.context.businessId,
    toStatus: body.status,
    reason: body.reason,
    recoveryNotes: body.recoveryNotes,
    actorUserId: auth.context.businessUserId,
  });

  return NextResponse.json({ data: result });
}
