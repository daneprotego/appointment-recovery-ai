import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Appointment, AppointmentStatus, RecoveryOpportunity } from '@/lib/types/database';
import { recordCommunicationEvent } from '@/lib/workflows/communications';
import { scoreRecoveryOpportunity } from '@/lib/workflows/recovery-scoring';
import { autoFillCancelledSlot, findWaitlistMatches, suggestWaitlistMatches } from '@/lib/workflows/waitlist';

const allowedTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ['confirmed', 'cancelled', 'no_show', 'completed', 'rescheduled'],
  confirmed: ['cancelled', 'no_show', 'completed', 'rescheduled'],
  cancelled: ['rescheduled'],
  no_show: ['rescheduled'],
  completed: [],
  rescheduled: ['scheduled', 'confirmed', 'cancelled'],
};

export function canTransitionAppointmentStatus(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return from === to || allowedTransitions[from].includes(to);
}

export interface TransitionAppointmentStatusInput {
  appointmentId: string;
  businessId: string;
  toStatus: AppointmentStatus;
  reason?: string | null;
  recoveryNotes?: string | null;
  actorUserId?: string | null;
}

export interface TransitionAppointmentStatusResult {
  appointment: Appointment;
  recoveryOpportunity: RecoveryOpportunity | null;
  waitlistNotifications: number;
}

export async function openRecoveryOpportunity(appointment: Appointment): Promise<RecoveryOpportunity> {
  const supabase = getSupabaseAdminClient();
  const [{ data: customer, error: customerError }, waitlistMatches, waitlistSuggestions] = await Promise.all([
    supabase.from('customers').select('*').eq('id', appointment.customer_id).eq('business_id', appointment.business_id).single(),
    findWaitlistMatches(appointment),
    suggestWaitlistMatches(appointment),
  ]);

  if (customerError || !customer) {
    throw new Error(`Unable to load customer for recovery scoring: ${customerError?.message ?? 'customer not found'}`);
  }

  const score = scoreRecoveryOpportunity({ appointment, customer, openWaitlistMatches: waitlistMatches.length });
  const opportunityInput = {
    business_id: appointment.business_id,
    appointment_id: appointment.id,
    customer_id: appointment.customer_id,
    status: 'open',
    priority: score.priority,
    score: score.score,
    estimated_value_cents: appointment.value_cents,
    reason: score.reasons.join('; ') || 'appointment needs recovery',
    metadata: {
      reasons: score.reasons,
      waitlist_matches: waitlistMatches.length,
      matched_waitlist_customers: waitlistSuggestions,
    },
  };
  const { data, error } = await supabase
    .from('recovery_opportunities')
    .upsert(opportunityInput, { onConflict: 'appointment_id,status' })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Unable to create recovery opportunity: ${error.message}`);
  }

  return data as RecoveryOpportunity;
}

export async function transitionAppointmentStatus(input: TransitionAppointmentStatusInput): Promise<TransitionAppointmentStatusResult> {
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', input.appointmentId)
    .eq('business_id', input.businessId)
    .single();

  if (existingError || !existing) {
    throw new Error(`Appointment not found: ${existingError?.message ?? input.appointmentId}`);
  }

  const appointment = existing as Appointment;
  if (!canTransitionAppointmentStatus(appointment.status, input.toStatus)) {
    throw new Error(`Cannot transition appointment from ${appointment.status} to ${input.toStatus}.`);
  }

  const { data: updated, error: updateError } = await supabase
    .from('appointments')
    .update({
      status: input.toStatus,
      cancellation_reason: input.toStatus === 'cancelled' ? input.reason ?? appointment.cancellation_reason : appointment.cancellation_reason,
      recovery_notes: input.recoveryNotes ?? appointment.recovery_notes,
      metadata: {
        ...(typeof appointment.metadata === 'object' && appointment.metadata !== null && !Array.isArray(appointment.metadata) ? appointment.metadata : {}),
        last_status_transition: {
          from: appointment.status,
          to: input.toStatus,
          reason: input.reason ?? null,
          actor_user_id: input.actorUserId ?? null,
          transitioned_at: new Date().toISOString(),
        },
      },
    })
    .eq('id', appointment.id)
    .eq('business_id', input.businessId)
    .eq('status', appointment.status)
    .select('*')
    .maybeSingle();

  if (updateError) {
    throw new Error(`Unable to update appointment status: ${updateError.message}`);
  }

  if (!updated) {
    throw new Error(`Appointment status changed before transition could be applied. Expected ${appointment.status} while moving to ${input.toStatus}. Please reload and try again.`);
  }

  const updatedAppointment = updated as Appointment;
  await recordCommunicationEvent({
    businessId: updatedAppointment.business_id,
    customerId: updatedAppointment.customer_id,
    appointmentId: updatedAppointment.id,
    channel: 'system',
    direction: 'internal',
    eventType: 'status_change',
    body: `Appointment status changed from ${appointment.status} to ${input.toStatus}.`,
    metadata: { reason: input.reason ?? null, actor_user_id: input.actorUserId ?? null },
  });

  let recoveryOpportunity: RecoveryOpportunity | null = null;
  let waitlistNotifications = 0;

  if (input.toStatus === 'cancelled' || input.toStatus === 'no_show') {
    recoveryOpportunity = await openRecoveryOpportunity(updatedAppointment);
    const waitlistResult = await autoFillCancelledSlot(updatedAppointment);
    waitlistNotifications = waitlistResult.notified;
  }

  return { appointment: updatedAppointment, recoveryOpportunity, waitlistNotifications };
}
