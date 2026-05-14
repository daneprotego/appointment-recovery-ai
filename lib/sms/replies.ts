import type { AppointmentStatus, ReminderStatus } from '@/lib/types/database';

export type SmsReplyIntent = 'confirm' | 'cancel' | 'reschedule' | 'stop' | 'help' | 'unknown';

export interface ParsedSmsReply {
  intent: SmsReplyIntent;
  normalizedBody: string;
  keyword: string | null;
}

export interface ReplyStatusUpdate {
  appointmentStatus?: AppointmentStatus;
  reminderStatus?: ReminderStatus;
  customerSmsOptIn?: boolean;
  customerStatus?: 'active' | 'inactive' | 'blocked';
  recoveryNotes?: string;
}

const CONFIRM_KEYWORDS = new Set(['YES', 'Y', 'CONFIRM', 'CONFIRMED']);
const CANCEL_KEYWORDS = new Set(['CANCEL', 'CANCELLED', 'NO', 'N']);
const RESCHEDULE_KEYWORDS = new Set(['RESCHEDULE', 'REBOOK', 'CHANGE']);
const STOP_KEYWORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCELALL', 'END', 'QUIT']);
const HELP_KEYWORDS = new Set(['HELP', 'INFO']);

export function parseSmsReply(body: string): ParsedSmsReply {
  const normalizedBody = body.trim().replace(/\s+/g, ' ').toUpperCase();
  const keyword = normalizedBody.split(' ')[0] || null;

  if (keyword && STOP_KEYWORDS.has(keyword)) {
    return { intent: 'stop', normalizedBody, keyword };
  }

  if (keyword && HELP_KEYWORDS.has(keyword)) {
    return { intent: 'help', normalizedBody, keyword };
  }

  if (keyword && CONFIRM_KEYWORDS.has(keyword)) {
    return { intent: 'confirm', normalizedBody, keyword };
  }

  if (keyword && CANCEL_KEYWORDS.has(keyword)) {
    return { intent: 'cancel', normalizedBody, keyword };
  }

  if (keyword && RESCHEDULE_KEYWORDS.has(keyword)) {
    return { intent: 'reschedule', normalizedBody, keyword };
  }

  return { intent: 'unknown', normalizedBody, keyword };
}

export function getReplyStatusUpdate(parsedReply: ParsedSmsReply): ReplyStatusUpdate {
  switch (parsedReply.intent) {
    case 'confirm':
      return {
        appointmentStatus: 'confirmed',
        reminderStatus: 'delivered',
        recoveryNotes: 'Customer confirmed by SMS reply.',
      };
    case 'cancel':
      return {
        appointmentStatus: 'cancelled',
        reminderStatus: 'cancelled',
        recoveryNotes: 'Customer cancelled by SMS reply.',
      };
    case 'reschedule':
      return {
        appointmentStatus: 'rescheduled',
        reminderStatus: 'delivered',
        recoveryNotes: 'Customer requested rescheduling by SMS reply.',
      };
    case 'stop':
      return {
        reminderStatus: 'cancelled',
        customerSmsOptIn: false,
        customerStatus: 'blocked',
        recoveryNotes: 'Customer opted out of SMS reminders.',
      };
    case 'help':
      return {
        reminderStatus: 'delivered',
        recoveryNotes: 'Customer requested SMS help instructions.',
      };
    case 'unknown':
      return {
        reminderStatus: 'delivered',
        recoveryNotes: 'Customer sent an unrecognized SMS reply.',
      };
  }
}

export function getTwilioWebhookResponseMessage(intent: SmsReplyIntent): string {
  switch (intent) {
    case 'confirm':
      return 'Thanks, your appointment is confirmed.';
    case 'cancel':
      return 'Thanks, we received your cancellation request.';
    case 'reschedule':
      return 'Thanks, we received your reschedule request. We will follow up with new times.';
    case 'stop':
      return 'You have been unsubscribed from SMS reminders. Reply HELP for help.';
    case 'help':
      return 'Reply YES or CONFIRM to confirm, CANCEL to cancel, RESCHEDULE to change, or STOP to opt out.';
    case 'unknown':
      return 'Thanks. Reply YES to confirm, CANCEL to cancel, RESCHEDULE to change, STOP to opt out, or HELP for help.';
  }
}
