import { getAppEnvironment } from '@/lib/types/env';

export interface SmsMessageInput {
  to: string;
  body: string;
  messagingServiceSid?: string;
  from?: string;
}

export interface SmsMessageResult {
  provider: 'twilio';
  queued: boolean;
  providerMessageId: string | null;
}

export async function queueSmsReminder(input: SmsMessageInput): Promise<SmsMessageResult> {
  const env = getAppEnvironment();
  const messagingServiceSid = input.messagingServiceSid || env.twilioMessagingServiceSid;
  const from = input.from || env.twilioPhoneNumber;

  void input;
  void env.twilioAccountSid;
  void env.twilioAuthToken;
  void messagingServiceSid;
  void from;

  return {
    provider: 'twilio',
    queued: false,
    providerMessageId: null,
  };
}
