import { cache } from 'react';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { AppointmentStatus, CommunicationEventType, RecoveryOpportunityStatus } from '@/lib/types/database';
import type { AnalyticsActivity, AnalyticsAppointment, AnalyticsOpportunity, PeriodBounds } from './analytics';

interface EventRow {
  id: string; event_type: CommunicationEventType; occurred_at: string;
  customers: { first_name: string; last_name: string } | null;
  appointments: { service_name: string; starts_at: string } | null;
}

export interface DashboardAnalyticsRows {
  appointments: AnalyticsAppointment[];
  opportunities: AnalyticsOpportunity[];
  activity: AnalyticsActivity[];
}

export const getDashboardAnalyticsRows = cache(async (businessId: string, bounds: PeriodBounds): Promise<DashboardAnalyticsRows> => {
  const supabase = getSupabaseAdminClient();
  const [appointments, opportunities, activity] = await Promise.all([
    supabase.from('appointments').select('id, starts_at, status').eq('business_id', businessId)
      .gte('starts_at', bounds.priorStart.toISOString()).lt('starts_at', bounds.end.toISOString()),
    supabase.from('recovery_opportunities').select('id, status, created_at, resolved_at, estimated_value_cents, recovered_value_cents')
      .eq('business_id', businessId)
      .or(`created_at.gte.${bounds.priorStart.toISOString()},resolved_at.gte.${bounds.priorStart.toISOString()}`),
    supabase.from('communication_events')
      .select('id, event_type, occurred_at, customers(first_name, last_name), appointments(service_name, starts_at)')
      .eq('business_id', businessId).order('occurred_at', { ascending: false }).limit(8).returns<EventRow[]>(),
  ]);
  for (const result of [appointments, opportunities, activity]) if (result.error) throw new Error(result.error.message);

  return {
    appointments: (appointments.data ?? []).map((row) => ({ id: row.id as string, startsAt: row.starts_at as string, status: row.status as AppointmentStatus })),
    opportunities: (opportunities.data ?? []).map((row) => ({
      id: row.id as string, status: row.status as RecoveryOpportunityStatus, createdAt: row.created_at as string,
      resolvedAt: row.resolved_at as string | null, estimatedValueCents: row.estimated_value_cents as number,
      recoveredValueCents: row.recovered_value_cents as number,
    })),
    activity: (activity.data ?? []).map((event) => ({
      id: event.id, eventType: event.event_type, occurredAt: event.occurred_at,
      customerName: event.customers ? `${event.customers.first_name} ${event.customers.last_name}` : null,
      appointmentName: event.appointments ? `${event.appointments.service_name} · ${new Date(event.appointments.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : null,
    })),
  };
});
