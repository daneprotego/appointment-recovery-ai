import { queueSmsReminder, type SmsMessageResult } from '@/lib/sms/twilio';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Business, Customer, Json, Reminder } from '@/lib/types/database';

export interface SmsReminderDeliveryContext {
  business: Pick<Business, 'sms_from_number'>;
  customer: Pick<Customer, 'phone' | 'sms_opt_in'>;
  reminder: Pick<Reminder, 'id' | 'message_body' | 'metadata' | 'status'>;
}

export interface SmsReminderDeliveryResult extends SmsMessageResult {
  reminderStatus: Reminder['status'];
}

function jsonObject(value: Json): { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}

function mergeReminderMetadata(reminder: Pick<Reminder, 'metadata'>, result: SmsMessageResult): Json {
  return {
    ...jsonObject(reminder.metadata),
    sms_delivery: {
      provider: result.provider,
      dry_run: result.dryRun,
      twilio_message_sid: result.providerMessageId,
      sent_at: result.queued ? new Date().toISOString() : null,
      error_message: result.errorMessage ?? null,
      ...(result.providerMetadata && typeof result.providerMetadata === 'object' && !Array.isArray(result.providerMetadata) ? result.providerMetadata : {}),
    },
  };
}

export async function sendSmsReminder(context: SmsReminderDeliveryContext): Promise<SmsReminderDeliveryResult> {
  const supabase = getSupabaseAdminClient();
  if (!context.customer.sms_opt_in || !context.customer.phone) {
    const errorMessage = 'Customer is not opted in to SMS or does not have a phone number.';
    console.warn('[sms:delivery] SMS reminder cancelled.', { reminderId: context.reminder.id, errorMessage });
    await supabase
      .from('reminders')
      .update({ status: 'cancelled', error_message: errorMessage, locked_at: null })
      .eq('id', context.reminder.id);

    return {
      provider: 'twilio',
      queued: false,
      dryRun: true,
      providerMessageId: null,
      reminderStatus: 'cancelled',
      errorMessage,
    };
  }

  const result = await queueSmsReminder({
    to: context.customer.phone,
    body: context.reminder.message_body ?? '',
    from: context.business.sms_from_number ?? undefined,
  });

  const reminderStatus: Reminder['status'] = result.queued ? 'sent' : result.dryRun ? 'queued' : 'failed';
  const metadata = mergeReminderMetadata(context.reminder, result);

  await supabase
    .from('reminders')
    .update({
      status: reminderStatus,
      sent_at: result.queued ? new Date().toISOString() : null,
      locked_at: null,
      provider_message_id: result.providerMessageId,
      error_message: result.errorMessage ?? null,
      metadata,
    })
    .eq('id', context.reminder.id);

  if (result.queued) {
    console.info('[sms:delivery] SMS reminder sent through Twilio.', { reminderId: context.reminder.id, twilioMessageSid: result.providerMessageId });
  } else if (result.dryRun) {
    console.warn('[sms:delivery] SMS reminder left queued by safe fallback.', { reminderId: context.reminder.id, errorMessage: result.errorMessage });
  } else {
    console.error('[sms:delivery] SMS reminder delivery failed.', { reminderId: context.reminder.id, errorMessage: result.errorMessage });
  }

  return {
    ...result,
    reminderStatus,
  };
}
