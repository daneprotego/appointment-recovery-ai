import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Appointment, RecoveryOpportunity, Reminder, WaitlistEntry } from '@/lib/types/database';

export interface RecoveryAnalytics {
  appointmentCounts: Record<string, number>;
  openOpportunities: number;
  recoveredOpportunities: number;
  recoveredValueCents: number;
  averageRecoveryScore: number;
  dueReminderBacklog: number;
  waitlistOpen: number;
  waitlistNotified: number;
}

function countByStatus<T extends { status: string }>(items: T[]): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
}

export async function getRecoveryAnalytics(businessId: string): Promise<RecoveryAnalytics> {
  const supabase = getSupabaseAdminClient();
  const [appointmentsResult, opportunitiesResult, remindersResult, waitlistsResult] = await Promise.all([
    supabase.from('appointments').select('*').eq('business_id', businessId),
    supabase.from('recovery_opportunities').select('*').eq('business_id', businessId),
    supabase.from('reminders').select('*').eq('business_id', businessId).in('status', ['queued', 'failed', 'processing']),
    supabase.from('waitlists').select('*').eq('business_id', businessId).in('status', ['open', 'notified']),
  ]);

  for (const result of [appointmentsResult, opportunitiesResult, remindersResult, waitlistsResult]) {
    if (result.error) {
      throw new Error(`Unable to load recovery analytics: ${result.error.message}`);
    }
  }

  const appointments = (appointmentsResult.data ?? []) as Appointment[];
  const opportunities = (opportunitiesResult.data ?? []) as RecoveryOpportunity[];
  const reminders = (remindersResult.data ?? []) as Reminder[];
  const waitlists = (waitlistsResult.data ?? []) as WaitlistEntry[];
  const recovered = opportunities.filter((opportunity) => opportunity.status === 'recovered');
  const scored = opportunities.filter((opportunity) => opportunity.score > 0);

  return {
    appointmentCounts: countByStatus(appointments),
    openOpportunities: opportunities.filter((opportunity) => opportunity.status === 'open').length,
    recoveredOpportunities: recovered.length,
    recoveredValueCents: recovered.reduce((sum, opportunity) => sum + opportunity.estimated_value_cents, 0),
    averageRecoveryScore: scored.length ? Math.round(scored.reduce((sum, opportunity) => sum + opportunity.score, 0) / scored.length) : 0,
    dueReminderBacklog: reminders.length,
    waitlistOpen: waitlists.filter((entry) => entry.status === 'open').length,
    waitlistNotified: waitlists.filter((entry) => entry.status === 'notified').length,
  };
}
