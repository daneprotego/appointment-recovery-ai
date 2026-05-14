import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Appointment, WaitlistEntry } from '@/lib/types/database';
import { recordCommunicationEvent } from '@/lib/workflows/communications';

export interface WaitlistMatchResult {
  matched: WaitlistEntry[];
  notified: number;
}

function serviceMatches(entry: Pick<WaitlistEntry, 'requested_service_name'>, appointment: Pick<Appointment, 'service_name'>): boolean {
  return !entry.requested_service_name || entry.requested_service_name.toLowerCase() === appointment.service_name.toLowerCase();
}

function timeWindowMatches(entry: Pick<WaitlistEntry, 'earliest_start_at' | 'latest_start_at'>, startsAt: string): boolean {
  const startTime = new Date(startsAt).getTime();
  const earliest = entry.earliest_start_at ? new Date(entry.earliest_start_at).getTime() : null;
  const latest = entry.latest_start_at ? new Date(entry.latest_start_at).getTime() : null;

  return (earliest === null || startTime >= earliest) && (latest === null || startTime <= latest);
}

export async function findWaitlistMatches(appointment: Pick<Appointment, 'id' | 'business_id' | 'service_name' | 'starts_at'>, limit = 5): Promise<WaitlistEntry[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('waitlists')
    .select('*')
    .eq('business_id', appointment.business_id)
    .eq('status', 'open')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Unable to find waitlist matches: ${error.message}`);
  }

  return ((data ?? []) as WaitlistEntry[])
    .filter((entry) => serviceMatches(entry, appointment) && timeWindowMatches(entry, appointment.starts_at))
    .slice(0, limit);
}

export async function autoFillCancelledSlot(appointment: Pick<Appointment, 'id' | 'business_id' | 'customer_id' | 'service_name' | 'starts_at'>): Promise<WaitlistMatchResult> {
  const supabase = getSupabaseAdminClient();
  const matched = await findWaitlistMatches(appointment, 3);
  let notified = 0;

  for (const entry of matched) {
    const { data: claimedEntry, error } = await supabase
      .from('waitlists')
      .update({
        status: 'notified',
        matched_appointment_id: appointment.id,
        metadata: {
          ...(typeof entry.metadata === 'object' && entry.metadata !== null && !Array.isArray(entry.metadata) ? entry.metadata : {}),
          matched_at: new Date().toISOString(),
          auto_fill_source: 'cancelled_slot',
        },
      })
      .eq('id', entry.id)
      .eq('business_id', appointment.business_id)
      .eq('status', 'open')
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to claim waitlist entry ${entry.id}: ${error.message}`);
    }

    if (claimedEntry) {
      const waitlistEntry = claimedEntry as WaitlistEntry;
      notified += 1;
      await recordCommunicationEvent({
        businessId: appointment.business_id,
        customerId: waitlistEntry.customer_id,
        appointmentId: appointment.id,
        channel: 'system',
        direction: 'outbound',
        eventType: 'waitlist_offer',
        body: `Waitlist auto-fill offer prepared for ${appointment.service_name}.`,
        metadata: { waitlist_id: waitlistEntry.id, starts_at: appointment.starts_at },
      });
    }
  }

  return { matched, notified };
}
