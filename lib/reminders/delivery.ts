import { queueSmsReminder, type SmsMessageResult } from '@/lib/sms/twilio';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Business, Customer, Reminder } from '@/lib/types/database';

export interface SmsReminderDeliveryContext {
  business: Pick<Business, 'twilio_messaging_service_sid' | 'sms_from_number'>;
  customer: Pick<Customer, 'phone' | 'sms_opt_in'>;
  reminder: Pick<Reminder, 'id' | 'message_body' | 'status'>;
}

export interface SmsReminderDeliveryResult extends SmsMessageResult {
  reminderStatus: Reminder['status'];
}

export async function sendSmsReminderPlaceholder(context: SmsReminderDeliveryContext): Promise<SmsReminderDeliveryResult> {
  const supabase = getSupabaseAdminClient();
  if (!context.customer.sms_opt_in || !context.customer.phone) {
    await supabase
      .from('reminders')
      .update({ status: 'cancelled', error_message: 'Customer is not opted in to SMS or does not have a phone number.' })
      .eq('id', context.reminder.id);

    return {
      provider: 'twilio',
      queued: false,
      dryRun: true,
      providerMessageId: null,
      reminderStatus: 'cancelled',
      errorMessage: 'Customer is not opted in to SMS or does not have a phone number.',
    };
  }

  const result = await queueSmsReminder({
    to: context.customer.phone,
    body: context.reminder.message_body ?? '',
    messagingServiceSid: context.business.twilio_messaging_service_sid ?? undefined,
    from: context.business.sms_from_number ?? undefined,
  });

  const reminderStatus: Reminder['status'] = result.queued ? 'sent' : result.dryRun ? 'queued' : 'failed';

  await supabase
    .from('reminders')
    .update({
      status: reminderStatus,
      sent_at: result.queued ? new Date().toISOString() : null,
      provider_message_id: result.providerMessageId,
      error_message: result.errorMessage ?? null,
    })
    .eq('id', context.reminder.id);

  return {
    ...result,
    reminderStatus,
  };
}
