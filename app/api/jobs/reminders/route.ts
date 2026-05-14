import { NextResponse, type NextRequest } from 'next/server';

import { processDueReminders } from '@/lib/jobs/reminder-processor';

const DEFAULT_REMINDER_JOB_LIMIT = 25;
const MAX_REMINDER_JOB_LIMIT = 100;

function isAuthorizedJobRequest(request: NextRequest): boolean {
  const configuredSecret = process.env.REMINDER_JOB_SECRET;
  if (!configuredSecret) {
    return process.env.NODE_ENV !== 'production';
  }

  return request.headers.get('x-job-secret') === configuredSecret;
}

function parseReminderJobLimit(value: unknown): { ok: true; limit: number } | { ok: false; message: string } {
  if (value === undefined || value === null) {
    return { ok: true, limit: DEFAULT_REMINDER_JOB_LIMIT };
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { ok: false, message: 'limit must be an integer.' };
  }

  if (value < 1) {
    return { ok: false, message: 'limit must be greater than 0.' };
  }

  return { ok: true, limit: Math.min(value, MAX_REMINDER_JOB_LIMIT) };
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized job request.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { limit?: unknown };
  const parsedLimit = parseReminderJobLimit(body.limit);

  if (!parsedLimit.ok) {
    return NextResponse.json({ error: parsedLimit.message }, { status: 400 });
  }

  const result = await processDueReminders({ limit: parsedLimit.limit });

  return NextResponse.json({ data: result });
}
