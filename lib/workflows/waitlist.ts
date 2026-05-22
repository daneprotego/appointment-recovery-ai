import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Appointment, WaitlistEntry } from '@/lib/types/database';
import { recordCommunicationEvent } from '@/lib/workflows/communications';

export interface WaitlistMatchResult {
  matched: WaitlistEntry[];
  notified: number;
}

export interface WaitlistMatchSuggestion {
  entryId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  requestedService: string;
  startsAt: string;
  urgencyScore: number;
}

function createdAtAgeBonus(createdAt: string): number {
  const createdAtMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) {
    return 0;
  }

  const daysOpen = Math.max(0, (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24));
  return Math.min(10, Math.floor(daysOpen / 7));
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

export async function suggestWaitlistMatches(
  appointment: Pick<Appointment, 'id' | 'business_id' | 'service_name' | 'starts_at' | 'risk_level'>,
  limit = 5,
): Promise<WaitlistMatchSuggestion[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('waitlists')
    .select('*, customers(first_name, last_name, phone, no_show_count)')
    .eq('business_id', appointment.business_id)
    .eq('status', 'open')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Unable to suggest waitlist matches: ${error.message}`);
  }

  const riskWeight = appointment.risk_level === 'high' ? 20 : appointment.risk_level === 'medium' ? 10 : 0;

  return ((data ?? []) as Array<WaitlistEntry & { customers: { first_name: string; last_name: string; phone: string | null; no_show_count: number } | null }>)
    .filter((entry) => serviceMatches(entry, appointment) && timeWindowMatches(entry, appointment.starts_at))
    .map((entry) => {
      const noShowCount = Math.max(0, entry.customers?.no_show_count ?? 0);
      const reliabilityBonus = Math.max(0, 20 - noShowCount * 5);
      const phoneBonus = entry.customers?.phone ? 3 : 0;
      const ageBonus = createdAtAgeBonus(entry.created_at);
      return {
        entryId: entry.id,
        customerId: entry.customer_id,
        customerName: entry.customers ? `${entry.customers.first_name} ${entry.customers.last_name}` : 'Unknown customer',
        customerPhone: entry.customers?.phone ?? '',
        requestedService: entry.requested_service_name ?? appointment.service_name,
        startsAt: appointment.starts_at,
        urgencyScore: riskWeight + reliabilityBonus + phoneBonus + ageBonus,
      };
    })
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
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
