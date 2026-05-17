'use server';

import { revalidatePath } from 'next/cache';

import { requireOnboardedSession } from '@/lib/auth/session';
import { sendSmsReminder } from '@/lib/reminders/delivery';
import { buildSmsReminderInput } from '@/lib/reminders/scheduling';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordCommunicationEvent } from '@/lib/workflows/communications';
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
  const payload = {
    business_id: session.business.id,
    customer_id: customerId,
    service_name: getString(formData, 'serviceName'),
    starts_at: startsAt,
    ends_at: endsAt,
    status: enumValue(getString(formData, 'status'), appointmentStatuses, 'scheduled') as AppointmentStatus,
    risk_level: enumValue(getString(formData, 'riskLevel'), riskLevels, 'low') as AppointmentRiskLevel,
    value_cents: getCents(formData, 'value'),
    cancellation_reason: getString(formData, 'cancellationReason') || null,
    recovery_notes: getString(formData, 'recoveryNotes') || null,
  };
  const query = id
    ? supabase.from('appointments').update(payload).eq('id', id).eq('business_id', session.business.id)
    : supabase.from('appointments').insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
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
