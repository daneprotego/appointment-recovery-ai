import { getAppEnvironment } from '@/lib/types/env';

export interface SmsMessageInput {
  to: string;
  body: string;
  messagingServiceSid?: string;
  from?: string;
  statusCallbackUrl?: string;
}

export interface SmsMessageResult {
  provider: 'twilio';
  queued: boolean;
  dryRun: boolean;
  providerMessageId: string | null;
  errorMessage?: string;
}

interface TwilioMessageResponse {
  sid?: string;
  error_message?: string | null;
  message?: string;
}

function isTwilioEnabled(value: string): boolean {
  return value.toLowerCase() === 'true';
}

function hasTwilioCredentials(accountSid: string, authToken: string): boolean {
  return Boolean(accountSid && authToken);
}

export async function queueSmsReminder(input: SmsMessageInput): Promise<SmsMessageResult> {
  const env = getAppEnvironment();
  const messagingServiceSid = input.messagingServiceSid || env.twilioMessagingServiceSid;
  const from = input.from || env.twilioPhoneNumber;
  const enabled = isTwilioEnabled(env.twilioSmsEnabled);

  if (!enabled) {
    return {
      provider: 'twilio',
      queued: false,
      dryRun: true,
      providerMessageId: null,
      errorMessage: 'SMS sending is disabled. Set TWILIO_SMS_ENABLED=true to send real messages.',
    };
  }

  if (!hasTwilioCredentials(env.twilioAccountSid, env.twilioAuthToken)) {
    return {
      provider: 'twilio',
      queued: false,
      dryRun: false,
      providerMessageId: null,
      errorMessage: 'Missing Twilio credentials.',
    };
  }

  if (!messagingServiceSid && !from) {
    return {
      provider: 'twilio',
      queued: false,
      dryRun: false,
      providerMessageId: null,
      errorMessage: 'Missing Twilio Messaging Service SID or from phone number.',
    };
  }

  const params = new URLSearchParams({
    To: input.to,
    Body: input.body,
  });

  if (messagingServiceSid) {
    params.set('MessagingServiceSid', messagingServiceSid);
  } else if (from) {
    params.set('From', from);
  }

  if (input.statusCallbackUrl) {
    params.set('StatusCallback', input.statusCallbackUrl);
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.twilioAccountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  const payload = (await response.json()) as TwilioMessageResponse;

  return {
    provider: 'twilio',
    queued: response.ok,
    dryRun: false,
    providerMessageId: payload.sid ?? null,
    errorMessage: response.ok
      ? payload.error_message ?? undefined
      : payload.message ?? 'Twilio request failed.',
  };
}
