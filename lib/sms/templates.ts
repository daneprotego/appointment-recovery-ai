export interface SmsReminderTemplateInput {
  businessName: string;
  customerFirstName: string;
  serviceName: string;
  startsAt: string | Date;
  timezone?: string;
  replyInstructions?: string;
}

export interface SmsReminderTemplateResult {
  template: 'appointment_reminder_v1';
  body: string;
}

function formatAppointmentStart(startsAt: string | Date, timezone = 'UTC'): string {
  const date = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(date);
}

export function generateSmsReminderTemplate(input: SmsReminderTemplateInput): SmsReminderTemplateResult {
  const appointmentTime = formatAppointmentStart(input.startsAt, input.timezone);
  const replyInstructions = input.replyInstructions ?? 'Reply YES to confirm, CANCEL to cancel, RESCHEDULE to change, STOP to opt out, or HELP.';

  return {
    template: 'appointment_reminder_v1',
    body: `${input.businessName}: Hi ${input.customerFirstName}, reminder for your ${input.serviceName} appointment on ${appointmentTime}. ${replyInstructions}`,
  };
}
