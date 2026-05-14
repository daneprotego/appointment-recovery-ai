import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Appointment, Business, CreateReminderInput, Customer, Reminder } from '@/lib/types/database';
import { generateSmsReminderTemplate } from '@/lib/sms/templates';

export interface ReminderScheduleOptions {
  leadTimeMinutes?: number;
  now?: Date;
}

export interface ReminderSchedulingContext {
  business: Pick<Business, 'id' | 'name' | 'timezone'>;
  appointment: Pick<Appointment, 'id' | 'business_id' | 'customer_id' | 'service_name' | 'starts_at'>;
  customer: Pick<Customer, 'id' | 'first_name' | 'sms_opt_in' | 'phone'>;
}

export const DEFAULT_SMS_REMINDER_LEAD_TIME_MINUTES = 24 * 60;

export function calculateReminderSendTime(startsAt: string | Date, options: ReminderScheduleOptions = {}): Date {
  const leadTimeMinutes = options.leadTimeMinutes ?? DEFAULT_SMS_REMINDER_LEAD_TIME_MINUTES;
  const now = options.now ?? new Date();
  const appointmentStart = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  const scheduledFor = new Date(appointmentStart.getTime() - leadTimeMinutes * 60 * 1000);

  return scheduledFor > now ? scheduledFor : now;
}

export function buildSmsReminderInput(
  context: ReminderSchedulingContext,
  options: ReminderScheduleOptions = {},
): CreateReminderInput {
  const template = generateSmsReminderTemplate({
    businessName: context.business.name,
    customerFirstName: context.customer.first_name,
    serviceName: context.appointment.service_name,
    startsAt: context.appointment.starts_at,
    timezone: context.business.timezone,
  });

  return {
    business_id: context.business.id,
    appointment_id: context.appointment.id,
    customer_id: context.customer.id,
    channel: 'sms',
    status: context.customer.sms_opt_in && context.customer.phone ? 'queued' : 'cancelled',
    scheduled_for: calculateReminderSendTime(context.appointment.starts_at, options).toISOString(),
    sent_at: null,
    delivered_at: null,
    provider_message_id: null,
    message_template: template.template,
    message_body: template.body,
    error_message: context.customer.sms_opt_in && context.customer.phone ? null : 'Customer is not opted in to SMS or does not have a phone number.',
    attempt_count: 0,
    max_attempts: 3,
    next_attempt_at: null,
    last_attempt_at: null,
    locked_at: null,
    metadata: {
      lead_time_minutes: options.leadTimeMinutes ?? DEFAULT_SMS_REMINDER_LEAD_TIME_MINUTES,
      scheduling_source: 'sms_reminder_foundation',
    },
  };
}

export async function scheduleSmsReminder(
  context: ReminderSchedulingContext,
  options: ReminderScheduleOptions = {},
): Promise<Reminder> {
  const reminderInput = buildSmsReminderInput(context, options);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('reminders').insert(reminderInput).select('*').single();

  if (error) {
    throw new Error(`Unable to schedule SMS reminder: ${error.message}`);
  }

  return data as Reminder;
}
