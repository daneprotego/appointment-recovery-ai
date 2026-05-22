'use server';

import { revalidatePath } from 'next/cache';

import { requireOnboardedSession } from '@/lib/auth/session';
import { sendSmsReminder } from '@/lib/reminders/delivery';
import { buildSmsReminderInput } from '@/lib/reminders/scheduling';
import { queueSmsReminder } from '@/lib/sms/twilio';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordCommunicationEvent } from '@/lib/workflows/communications';
import { transitionAppointmentStatus } from '@/lib/workflows/appointment-lifecycle';
import type {
  AppointmentRiskLevel,
  AppointmentStatus,
  CustomerStatus,
  RecoveryOpportunityPriority,
  RecoveryOpportunityStatus,
  WaitlistStatus,
  Appointment,
  Business,
  Customer,
  Reminder,
  WaitlistEntry,
} from '@/lib/types/database';

const appointmentStatuses = ['scheduled', 'confirmed', 'cancelled', 'no_show', 'completed', 'rescheduled'] as const;
const riskLevels = ['low', 'medium', 'high', 'recovered'] as const;
const customerStatuses = ['active', 'inactive', 'blocked'] as const;
const waitlistStatuses = ['open', 'matched', 'notified', 'booked', 'expired', 'cancelled'] as const;
const opportunityStatuses = ['open', 'contacted', 'recovered', 'lost', 'expired'] as const;
const opportunityPriorities = ['low', 'medium', 'high', 'urgent'] as const;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getNumber(formData: FormData, key: string) {
  const value = Number(getString(formData, key));
  return Number.isFinite(value) ? value : 0;
}

function getCents(formData: FormData, key: string) {
  return Math.max(0, Math.round(getNumber(formData, key) * 100));
}

function getIsoDate(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value ? new Date(value).toISOString() : null;
}

function enumValue<T extends readonly string[]>(value: string, options: T, fallback: T[number]) {
  return options.includes(value) ? (value as T[number]) : fallback;
}

function revalidateDashboard() {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/appointments');
  revalidatePath('/dashboard/customers');
  revalidatePath('/dashboard/waitlist');
  revalidatePath('/dashboard/recovery');
}

async function assertSession() {
  const session = await requireOnboardedSession();
  return { session, supabase: getSupabaseAdminClient() };
}

async function requireCustomerForBusiness({
  customerId,
  businessId,
  supabase,
}: {
  customerId: string;
  businessId: string;
  supabase: ReturnType<typeof getSupabaseAdminClient>;
}) {
  if (!customerId) {
    throw new Error('A valid customer is required.');
  }

  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(`Unable to validate customer ownership: ${error.message}`);
  }

  if (!data) {
    throw new Error('Invalid customer reference: customer does not belong to this business.');
  }
}

async function requireAppointmentForBusiness({
  appointmentId,
  businessId,
  supabase,
}: {
  appointmentId: string;
  businessId: string;
  supabase: ReturnType<typeof getSupabaseAdminClient>;
}) {
  if (!appointmentId) {
    throw new Error('A valid appointment is required.');
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('id, customer_id')
    .eq('id', appointmentId)
    .eq('business_id', businessId)
    .maybeSingle<{ id: string; customer_id: string }>();

  if (error) {
    throw new Error(`Unable to validate appointment ownership: ${error.message}`);
  }

  if (!data) {
    throw new Error('Invalid appointment reference: appointment does not belong to this business.');
  }

  await requireCustomerForBusiness({ customerId: data.customer_id, businessId, supabase });

  return data;
}

export async function saveCustomerAction(formData: FormData) {
  const { session, supabase } = await assertSession();
  const id = getString(formData, 'id');
  const payload = {
    business_id: session.business.id,
    first_name: getString(formData, 'firstName'),
    last_name: getString(formData, 'lastName'),
    email: getString(formData, 'email') || null,
    phone: getString(formData, 'phone') || null,
    status: enumValue(getString(formData, 'status'), customerStatuses, 'active') as CustomerStatus,
    sms_opt_in: getString(formData, 'smsOptIn') === 'on',
    email_opt_in: getString(formData, 'emailOptIn') === 'on',
    no_show_count: Math.max(0, getNumber(formData, 'noShowCount')),
    lifetime_value_cents: getCents(formData, 'lifetimeValue'),
    notes: getString(formData, 'notes') || null,
  };

  const query = id
    ? supabase.from('customers').update(payload).eq('id', id).eq('business_id', session.business.id)
    : supabase.from('customers').insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidateDashboard();
}

export async function deleteCustomerAction(formData: FormData) {
  const { session, supabase } = await assertSession();
  const id = getString(formData, 'id');
  const { error } = await supabase.from('customers').delete().eq('id', id).eq('business_id', session.business.id);
  if (error) throw new Error(error.message);
  revalidateDashboard();
}

export async function saveAppointmentAction(formData: FormData) {
  const { session, supabase } = await assertSession();
  const id = getString(formData, 'id');
  const customerId = getString(formData, 'customerId');
  await requireCustomerForBusiness({ customerId, businessId: session.business.id, supabase });

  const startsAt = getIsoDate(formData, 'startsAt') ?? new Date().toISOString();
  const endsAt = getIsoDate(formData, 'endsAt');
  const status = enumValue(getString(formData, 'status'), appointmentStatuses, 'scheduled') as AppointmentStatus;
  const payload = {
    business_id: session.business.id,
    customer_id: customerId,
    service_name: getString(formData, 'serviceName'),
    starts_at: startsAt,
    ends_at: endsAt,
    status,
    risk_level: enumValue(getString(formData, 'riskLevel'), riskLevels, 'low') as AppointmentRiskLevel,
    value_cents: getCents(formData, 'value'),
    cancellation_reason: getString(formData, 'cancellationReason') || null,
    recovery_notes: getString(formData, 'recoveryNotes') || null,
  };

  if (id) {
    const { data: existing, error: existingError } = await supabase
      .from('appointments')
      .select('id, status')
      .eq('id', id)
      .eq('business_id', session.business.id)
      .maybeSingle<{ id: string; status: AppointmentStatus }>();

    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error('Appointment not found for this business.');

    const nonStatusPayload = {
      customer_id: payload.customer_id,
      service_name: payload.service_name,
      starts_at: payload.starts_at,
      ends_at: payload.ends_at,
      risk_level: payload.risk_level,
      value_cents: payload.value_cents,
    };

    const { error: updateError } = await supabase.from('appointments').update(nonStatusPayload).eq('id', id).eq('business_id', session.business.id);
    if (updateError) throw new Error(updateError.message);

    if (existing.status !== status) {
      await transitionAppointmentStatus({
        appointmentId: id,
        businessId: session.business.id,
        toStatus: status,
        reason: payload.cancellation_reason,
        recoveryNotes: payload.recovery_notes,
      });
    } else {
      const { error: sameStatusUpdateError } = await supabase
        .from('appointments')
        .update({ cancellation_reason: payload.cancellation_reason, recovery_notes: payload.recovery_notes })
        .eq('id', id)
        .eq('business_id', session.business.id);
      if (sameStatusUpdateError) throw new Error(sameStatusUpdateError.message);
    }
  } else {
    const { error } = await supabase.from('appointments').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidateDashboard();
}

export async function deleteAppointmentAction(formData: FormData) {
  const { session, supabase } = await assertSession();
  const id = getString(formData, 'id');
  const { error } = await supabase.from('appointments').delete().eq('id', id).eq('business_id', session.business.id);
  if (error) throw new Error(error.message);
  revalidateDashboard();
}

export async function saveWaitlistAction(formData: FormData) {
  const { session, supabase } = await assertSession();
  const id = getString(formData, 'id');
  const customerId = getString(formData, 'customerId');
  const matchedAppointmentId = getString(formData, 'matchedAppointmentId') || null;

  await requireCustomerForBusiness({ customerId, businessId: session.business.id, supabase });

  if (matchedAppointmentId) {
    await requireAppointmentForBusiness({ appointmentId: matchedAppointmentId, businessId: session.business.id, supabase });
  }

  const payload = {
    business_id: session.business.id,
    customer_id: customerId,
    requested_service_name: getString(formData, 'requestedServiceName') || null,
    earliest_start_at: getIsoDate(formData, 'earliestStartAt'),
    latest_start_at: getIsoDate(formData, 'latestStartAt'),
    preferred_days: getString(formData, 'preferredDays').split(',').map((day) => day.trim()).filter(Boolean),
    preferred_times: getString(formData, 'preferredTimes').split(',').map((time) => time.trim()).filter(Boolean),
    status: enumValue(getString(formData, 'status'), waitlistStatuses, 'open') as WaitlistStatus,
    matched_appointment_id: matchedAppointmentId,
    notes: getString(formData, 'notes') || null,
  };
  const query = id
    ? supabase.from('waitlists').update(payload).eq('id', id).eq('business_id', session.business.id)
    : supabase.from('waitlists').insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidateDashboard();
}

export async function deleteWaitlistAction(formData: FormData) {
  const { session, supabase } = await assertSession();
  const id = getString(formData, 'id');
  const { error } = await supabase.from('waitlists').delete().eq('id', id).eq('business_id', session.business.id);
  if (error) throw new Error(error.message);
  revalidateDashboard();
}

export async function saveRecoveryOpportunityAction(formData: FormData) {
  const { session, supabase } = await assertSession();
  const id = getString(formData, 'id');
  const status = enumValue(getString(formData, 'status'), opportunityStatuses, 'open') as RecoveryOpportunityStatus;
  const appointmentId = getString(formData, 'appointmentId');
  const appointment = await requireAppointmentForBusiness({ appointmentId, businessId: session.business.id, supabase });
  const payload = {
    business_id: session.business.id,
    appointment_id: appointmentId,
    customer_id: appointment.customer_id,
    status,
    priority: enumValue(getString(formData, 'priority'), opportunityPriorities, 'medium') as RecoveryOpportunityPriority,
    score: Math.min(100, Math.max(0, getNumber(formData, 'score'))),
    estimated_value_cents: getCents(formData, 'estimatedValue'),
    recovered_value_cents: getCents(formData, 'recoveredValue'),
    reason: getString(formData, 'reason') || null,
    resolved_at: ['recovered', 'lost', 'expired'].includes(status) ? new Date().toISOString() : null,
  };
  const query = id
    ? supabase.from('recovery_opportunities').update(payload).eq('id', id).eq('business_id', session.business.id)
    : supabase.from('recovery_opportunities').insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidateDashboard();
}

export async function deleteRecoveryOpportunityAction(formData: FormData) {
  const { session, supabase } = await assertSession();
  const id = getString(formData, 'id');
  const { error } = await supabase.from('recovery_opportunities').delete().eq('id', id).eq('business_id', session.business.id);
  if (error) throw new Error(error.message);
  revalidateDashboard();
}

export async function sendRecoveryOfferAction(formData: FormData): Promise<{ ok: boolean; message: string; dryRun: boolean }> {
  const { session, supabase } = await assertSession();
  const waitlistEntryId = getString(formData, 'waitlistEntryId');
  const appointmentId = getString(formData, 'appointmentId');

  if (!waitlistEntryId || !appointmentId) {
    return { ok: false, message: 'Missing waitlist entry or appointment reference.', dryRun: true };
  }

  const [{ data: appointment, error: appointmentError }, { data: waitlistEntry, error: waitlistError }] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, business_id, service_name, starts_at, status')
      .eq('id', appointmentId)
      .eq('business_id', session.business.id)
      .maybeSingle<{ id: string; business_id: string; service_name: string; starts_at: string; status: AppointmentStatus }>(),
    supabase
      .from('waitlists')
      .select('id, business_id, customer_id, status, metadata, customers(id, first_name, phone, sms_opt_in)')
      .eq('id', waitlistEntryId)
      .eq('business_id', session.business.id)
      .maybeSingle<WaitlistEntry & { customers: Pick<Customer, 'id' | 'first_name' | 'phone' | 'sms_opt_in'> | null }>(),
  ]);

  if (appointmentError || !appointment) {
    return { ok: false, message: `Appointment not found for this business: ${appointmentError?.message ?? appointmentId}`, dryRun: true };
  }
  if (waitlistError || !waitlistEntry) {
    return { ok: false, message: `Waitlist entry not found for this business: ${waitlistError?.message ?? waitlistEntryId}`, dryRun: true };
  }
  if (!['cancelled', 'no_show'].includes(appointment.status)) {
    return {
      ok: false,
      message: `Recovery offers can only be sent for cancelled or no-show appointments. Current status is ${appointment.status}.`,
      dryRun: true,
    };
  }
  if (waitlistEntry.status !== 'open') {
    return { ok: false, message: 'This waitlist entry is no longer open.', dryRun: true };
  }
  if (!waitlistEntry.customers?.phone) {
    return { ok: false, message: 'Cannot send offer: customer has no phone number.', dryRun: true };
  }
  if (waitlistEntry.customers.sms_opt_in === false) {
    return { ok: false, message: 'Cannot send offer: customer is not SMS opted-in.', dryRun: true };
  }

  const metadata = typeof waitlistEntry.metadata === 'object' && waitlistEntry.metadata !== null && !Array.isArray(waitlistEntry.metadata) ? waitlistEntry.metadata as Record<string, unknown> : {};
  const priorOffers = Array.isArray(metadata.offered_for_appointments) ? metadata.offered_for_appointments : [];
  if (priorOffers.includes(appointment.id)) {
    return { ok: false, message: 'Offer already sent to this waitlist entry for this appointment.', dryRun: true };
  }

  const smsResult = await queueSmsReminder({
    to: waitlistEntry.customers.phone,
    body: `${session.business.name}: Hi ${waitlistEntry.customers.first_name}, a ${appointment.service_name} slot opened at ${new Date(appointment.starts_at).toLocaleString()}. Reply YES to claim it.`,
  });

  if (!smsResult.queued && !smsResult.dryRun) {
    return { ok: false, message: smsResult.errorMessage ?? 'Unable to queue recovery offer.', dryRun: false };
  }

  const { error: updateError } = await supabase
    .from('waitlists')
    .update({
      status: 'notified',
      matched_appointment_id: appointment.id,
      metadata: {
        ...metadata,
        offered_for_appointments: [...priorOffers, appointment.id],
        last_offer_sent_at: new Date().toISOString(),
        last_offer_dry_run: smsResult.dryRun,
      },
    })
    .eq('id', waitlistEntry.id)
    .eq('business_id', session.business.id)
    .eq('status', 'open');

  if (updateError) {
    throw new Error(`Unable to update waitlist after offer send: ${updateError.message}`);
  }

  await recordCommunicationEvent({
    businessId: session.business.id,
    customerId: waitlistEntry.customer_id,
    appointmentId: appointment.id,
    channel: smsResult.dryRun ? 'system' : 'sms',
    direction: 'outbound',
    eventType: 'waitlist_offer',
    body: smsResult.dryRun
      ? `Dry-run recovery offer prepared for ${appointment.service_name} at ${appointment.starts_at}.`
      : `Recovery offer sent for ${appointment.service_name} at ${appointment.starts_at}.`,
    providerMessageId: smsResult.providerMessageId,
    metadata: { dry_run: smsResult.dryRun, provider: smsResult.provider, provider_metadata: smsResult.providerMetadata ?? {} },
  });

  revalidateDashboard();
  return {
    ok: true,
    dryRun: smsResult.dryRun,
    message: smsResult.dryRun ? 'Recovery offer dry-run queued (SMS disabled).' : 'Recovery offer sent successfully.',
  };
}

export async function sendAppointmentTestSmsAction(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const { session, supabase } = await assertSession();
  const appointmentId = getString(formData, 'id');

  if (!appointmentId) {
    return { ok: false, message: 'A valid appointment is required to send a test SMS.' };
  }

  const [{ data: business, error: businessError }, { data: appointment, error: appointmentError }] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, name, timezone, sms_from_number')
      .eq('id', session.business.id)
      .single(),
    supabase
      .from('appointments')
      .select('*, customers!inner(id, first_name, phone, sms_opt_in)')
      .eq('id', appointmentId)
      .eq('business_id', session.business.id)
      .single(),
  ]);

  if (businessError || !business) {
    throw new Error(`Unable to load business for test SMS: ${businessError?.message ?? 'business not found'}`);
  }

  if (appointmentError || !appointment) {
    throw new Error(`Unable to load appointment for test SMS: ${appointmentError?.message ?? 'appointment not found'}`);
  }

  const typedBusiness = business as Pick<Business, 'id' | 'name' | 'timezone' | 'sms_from_number'>;
  const typedAppointment = appointment as Appointment & { customers: Pick<Customer, 'id' | 'first_name' | 'phone' | 'sms_opt_in'> };
  const reminderInput = buildSmsReminderInput(
    {
      business: typedBusiness,
      appointment: typedAppointment,
      customer: typedAppointment.customers,
    },
    { leadTimeMinutes: 0, now: new Date() },
  );

  const { data: reminder, error: reminderError } = await supabase
    .from('reminders')
    .insert({
      ...reminderInput,
      scheduled_for: new Date().toISOString(),
      metadata: {
        ...(typeof reminderInput.metadata === 'object' && reminderInput.metadata !== null && !Array.isArray(reminderInput.metadata) ? reminderInput.metadata : {}),
        scheduling_source: 'dashboard_test_sms',
      },
    })
    .select('*')
    .single();

  if (reminderError || !reminder) {
    throw new Error(`Unable to create test SMS reminder: ${reminderError?.message ?? 'reminder not created'}`);
  }

  const typedReminder = reminder as Reminder;
  const delivery = await sendSmsReminder({
    business: typedBusiness,
    customer: typedAppointment.customers,
    reminder: typedReminder,
  });

  if (delivery.reminderStatus === 'sent') {
    await recordCommunicationEvent({
      businessId: typedReminder.business_id,
      customerId: typedReminder.customer_id,
      appointmentId: typedReminder.appointment_id,
      reminderId: typedReminder.id,
      channel: typedReminder.channel,
      direction: 'outbound',
      eventType: 'reminder_sent',
      body: typedReminder.message_body,
      providerMessageId: delivery.providerMessageId,
      metadata: {
        provider: delivery.provider,
        dry_run: delivery.dryRun,
        source: 'dashboard_test_sms',
        twilio_message_sid: delivery.providerMessageId,
        provider_metadata: delivery.providerMetadata ?? null,
      },
    });
  }

  revalidateDashboard();

  if (delivery.reminderStatus === 'sent') {
    return { ok: true, message: `Test SMS sent. Twilio SID: ${delivery.providerMessageId ?? 'unavailable'}.` };
  }

  if (delivery.dryRun) {
    return { ok: true, message: delivery.errorMessage ?? 'Test SMS skipped safely because Twilio is not configured.' };
  }

  return { ok: false, message: delivery.errorMessage ?? 'Unable to send test SMS reminder.' };
}
