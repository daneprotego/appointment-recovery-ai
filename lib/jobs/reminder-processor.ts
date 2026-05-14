import { sendSmsReminderPlaceholder, type SmsReminderDeliveryResult } from '@/lib/reminders/delivery';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Reminder } from '@/lib/types/database';
import { recordCommunicationEvent } from '@/lib/workflows/communications';

export interface ReminderJobOptions {
  limit?: number;
  now?: Date;
}

export interface ReminderJobResult {
  processed: number;
  sent: number;
  retried: number;
  failed: number;
  cancelled: number;
  dryRun: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const STALE_LOCK_THRESHOLD_MINUTES = 15;

function retryDelayMinutes(attemptCount: number): number {
  return Math.min(60, 5 * 2 ** Math.max(0, attemptCount - 1));
}

function getStaleLockCutoff(now: Date): string {
  return new Date(now.getTime() - STALE_LOCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();
}

async function recoverStaleProcessingLocks(now: Date): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('reminders')
    .update({
      status: 'queued',
      locked_at: null,
      next_attempt_at: now.toISOString(),
      error_message: 'Recovered stale reminder processing lock.',
    })
    .eq('status', 'processing')
    .lt('locked_at', getStaleLockCutoff(now));

  if (error) {
    throw new Error(`Unable to recover stale reminder locks: ${error.message}`);
  }
}

async function claimReminder(reminder: Reminder, now: Date): Promise<Reminder | null> {
  const supabase = getSupabaseAdminClient();
  const attemptCount = (reminder.attempt_count ?? 0) + 1;
  const { data, error } = await supabase
    .from('reminders')
    .update({
      status: 'processing',
      attempt_count: attemptCount,
      last_attempt_at: now.toISOString(),
      locked_at: now.toISOString(),
    })
    .eq('id', reminder.id)
    .in('status', ['queued', 'failed'])
    .lte('scheduled_for', now.toISOString())
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`)
    .or(`locked_at.is.null,locked_at.lt.${getStaleLockCutoff(now)}`)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to claim reminder ${reminder.id}: ${error.message}`);
  }

  return data as Reminder | null;
}

async function finalizeTerminalReminder(reminder: Reminder, delivery: SmsReminderDeliveryResult): Promise<void> {
  if (delivery.reminderStatus !== 'sent' && delivery.reminderStatus !== 'cancelled') {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('reminders')
    .update({
      status: delivery.reminderStatus,
      locked_at: null,
      sent_at: delivery.reminderStatus === 'sent' ? new Date().toISOString() : reminder.sent_at,
      provider_message_id: delivery.providerMessageId,
      error_message: delivery.errorMessage ?? null,
    })
    .eq('id', reminder.id);

  if (error) {
    throw new Error(`Unable to finalize ${delivery.reminderStatus} reminder ${reminder.id}: ${error.message}`);
  }
}

async function retryOrFailReminder(reminder: Reminder, attemptCount: number, now: Date, errorMessage: string): Promise<'retried' | 'failed'> {
  const supabase = getSupabaseAdminClient();
  const maxAttempts = reminder.max_attempts ?? DEFAULT_MAX_ATTEMPTS;

  if (attemptCount < maxAttempts) {
    const nextAttemptAt = new Date(now.getTime() + retryDelayMinutes(attemptCount) * 60 * 1000).toISOString();
    await supabase
      .from('reminders')
      .update({ status: 'queued', next_attempt_at: nextAttemptAt, error_message: errorMessage, locked_at: null })
      .eq('id', reminder.id);

    return 'retried';
  }

  await supabase
    .from('reminders')
    .update({ status: 'failed', next_attempt_at: null, error_message: errorMessage || 'Maximum reminder attempts reached.', locked_at: null })
    .eq('id', reminder.id);

  return 'failed';
}

export async function processDueReminders(options: ReminderJobOptions = {}): Promise<ReminderJobResult> {
  const supabase = getSupabaseAdminClient();
  const now = options.now ?? new Date();
  await recoverStaleProcessingLocks(now);

  const { data, error } = await supabase
    .from('reminders')
    .select('*, businesses!inner(twilio_messaging_service_sid, sms_from_number), customers!inner(phone, sms_opt_in)')
    .in('status', ['queued', 'failed'])
    .lte('scheduled_for', now.toISOString())
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`)
    .or(`locked_at.is.null,locked_at.lt.${getStaleLockCutoff(now)}`)
    .order('scheduled_for', { ascending: true })
    .limit(options.limit ?? 25);

  if (error) {
    throw new Error(`Unable to fetch due reminders: ${error.message}`);
  }

  const result: ReminderJobResult = { processed: 0, sent: 0, retried: 0, failed: 0, cancelled: 0, dryRun: 0 };

  for (const record of data ?? []) {
    const reminder = record as Reminder & {
      businesses: { twilio_messaging_service_sid: string | null; sms_from_number: string | null };
      customers: { phone: string | null; sms_opt_in: boolean };
    };

    let claimedReminder: Reminder | null = null;
    try {
      claimedReminder = await claimReminder(reminder, now);

      if (!claimedReminder) {
        continue;
      }

      result.processed += 1;
      const attemptCount = claimedReminder.attempt_count ?? (reminder.attempt_count ?? 0) + 1;
      const delivery = await sendSmsReminderPlaceholder({ business: reminder.businesses, customer: reminder.customers, reminder: claimedReminder });

      if (delivery.dryRun) {
        result.dryRun += 1;
      }

      if (delivery.reminderStatus === 'sent') {
        await finalizeTerminalReminder(claimedReminder, delivery);
        result.sent += 1;
        const sentReminder = claimedReminder;
        await recordCommunicationEvent({
          businessId: claimedReminder.business_id,
          customerId: claimedReminder.customer_id,
          appointmentId: claimedReminder.appointment_id,
          reminderId: claimedReminder.id,
          channel: claimedReminder.channel,
          direction: 'outbound',
          eventType: 'reminder_sent',
          body: claimedReminder.message_body,
          providerMessageId: delivery.providerMessageId,
          metadata: { provider: delivery.provider, dry_run: delivery.dryRun, attempt_count: attemptCount },
        }).catch(async (timelineError: unknown) => {
          const message = timelineError instanceof Error ? timelineError.message : 'Unable to record reminder_sent communication event.';
          await supabase.from('reminders').update({ error_message: message, locked_at: null }).eq('id', sentReminder.id);
        });
        continue;
      }

      if (delivery.reminderStatus === 'cancelled') {
        await finalizeTerminalReminder(claimedReminder, delivery);
        result.cancelled += 1;
        continue;
      }

      const retryResult = await retryOrFailReminder(claimedReminder, attemptCount, now, delivery.errorMessage ?? 'Reminder delivery failed.');
      result[retryResult] += 1;
    } catch (processingError) {
      if (!claimedReminder) {
        continue;
      }

      const message = processingError instanceof Error ? processingError.message : 'Unknown reminder processing error.';
      const attemptCount = claimedReminder.attempt_count ?? (reminder.attempt_count ?? 0) + 1;
      const retryResult = await retryOrFailReminder(claimedReminder, attemptCount, now, message);
      result[retryResult] += 1;
    }
  }

  return result;
}
