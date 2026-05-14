import { NextResponse } from 'next/server';

import { validateRequiredEnvironmentVariables } from '@/lib/env/validation';

export const dynamic = 'force-dynamic';

export function GET() {
  const validation = validateRequiredEnvironmentVariables();
  const status = validation.ok ? 200 : 503;

  return NextResponse.json(
    {
      status: validation.ok ? 'ok' : 'error',
      service: 'appointment-recovery-ai',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      checks: {
        requiredEnvironment: {
          ok: validation.ok,
          missing: validation.missing,
          placeholders: validation.placeholders,
        },
      },
    },
    { status },
  );
}
