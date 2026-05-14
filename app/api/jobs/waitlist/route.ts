import { NextResponse, type NextRequest } from 'next/server';

import { requireApiAuth } from '@/lib/auth/api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { autoFillCancelledSlot } from '@/lib/workflows/waitlist';

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, ['owner', 'admin']);

  if (!auth.ok) {
    return auth.response;
  }

  const supabase = getSupabaseAdminClient();
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('business_id', auth.context.businessId)
    .in('status', ['cancelled', 'no_show'])
    .order('updated_at', { ascending: false })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let notified = 0;
  for (const appointment of appointments ?? []) {
    const result = await autoFillCancelledSlot(appointment);
    notified += result.notified;
  }

  return NextResponse.json({ data: { scanned: appointments?.length ?? 0, notified } });
}
