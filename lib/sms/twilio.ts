import 'server-only';

import twilio from 'twilio';
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';

import type { Json } from '@/lib/types/database';
import { getAppEnvironment } from '@/lib/types/env';

export interface SmsMessageInput {
  to: string;
  body: string;
  from?: string;
  statusCallbackUrl?: string;
}

export interface SmsMessageResult {
  provider: 'twilio';
  queued: boolean;
  dryRun: boolean;
  providerMessageId: string | null;
  providerMetadata?: Json;
  errorMessage?: string;
}

interface TwilioSendConfig {
  accountSid: string;
  authToken: string;
  from: string;
  smsEnabled: boolean;
}

function isEnabled(value: string): boolean {
  return value.trim().toLowerCase() === 'true';
}

function getTwilioSendConfig(input: SmsMessageInput): TwilioSendConfig {
  const env = getAppEnvironment();

  return {
    accountSid: env.twilioAccountSid,
    authToken: env.twilioAuthToken,
    from: env.twilioSmsFromNumber || input.from || '',
    smsEnabled: isEnabled(env.twilioSmsEnabled),
  };
}

function getMissingConfiguration(config: TwilioSendConfig): string[] {
  return [
    config.accountSid ? null : 'TWILIO_ACCOUNT_SID',
    config.authToken ? null : 'TWILIO_AUTH_TOKEN',
    config.from ? null : 'TWILIO_SMS_FROM_NUMBER',
  ].filter((variable): variable is string => Boolean(variable));
}

function buildDryRunResult(reason: string, metadata: Json): SmsMessageResult {
  return {
    provider: 'twilio',
    queued: false,
    dryRun: true,
    providerMessageId: null,
    providerMetadata: metadata,
    errorMessage: reason,
  };
}

function buildTwilioMessageMetadata(message: MessageInstance): Json {
  return {
    twilio_message_sid: message.sid,
    twilio_status: message.status,
    twilio_account_sid: message.accountSid,
    twilio_from: message.from,
    twilio_to: message.to,
    twilio_error_code: message.errorCode ?? null,
    twilio_error_message: message.errorMessage ?? null,
  };
}

export async function queueSmsReminder(input: SmsMessageInput): Promise<SmsMessageResult> {
  console.info('[sms:twilio] queueSmsReminder:start', {
    to: input.to,
    hasBody: Boolean(input.body),
    hasFromOverride: Boolean(input.from),
    hasStatusCallbackUrl: Boolean(input.statusCallbackUrl),
  });

  const config = getTwilioSendConfig(input);
  console.info('[sms:twilio] sendSmsReminder:config', {
    twilioSmsEnabled: config.smsEnabled,
    hasAccountSid: Boolean(config.accountSid),
    hasAuthToken: Boolean(config.authToken),
    hasFrom: Boolean(config.from),
    to: input.to,
  });

  if (!config.smsEnabled) {
    console.info('[sms:twilio] sendSmsReminder:twilioSmsEnabledFalse', { to: input.to });
    const reason = 'SMS sending is disabled. Set TWILIO_SMS_ENABLED=true to send real Twilio messages.';
    const metadata = { twilio_sms_enabled: false, dry_run_reason: 'sms_disabled' };
    console.warn('[sms:twilio] Safe SMS dry run because sending is disabled.', { to: input.to, ...metadata });
    const result = buildDryRunResult(reason, metadata);
    console.info('[sms:twilio] sendSmsReminder:result', result);
    return result;
  }

  const missingConfiguration = getMissingConfiguration(config);
  console.info('[sms:twilio] sendSmsReminder:missingConfigurationCheck', {
    to: input.to,
    missingConfiguration,
  });
  if (missingConfiguration.length > 0) {
    const reason = `Missing Twilio SMS configuration (${missingConfiguration.join(', ')}). SMS send skipped safely.`;
    const metadata = {
      twilio_sms_enabled: true,
      dry_run_reason: 'missing_configuration',
      missing_configuration: missingConfiguration,
    };
    console.warn('[sms:twilio] Safe SMS dry run because configuration is incomplete.', { to: input.to, ...metadata });
    const result = buildDryRunResult(reason, metadata);
    console.info('[sms:twilio] sendSmsReminder:result', result);
    return result;
  }

  try {
    const client = twilio(config.accountSid, config.authToken);
    const message = await client.messages.create({
      to: input.to,
      from: config.from,
      body: input.body,
      ...(input.statusCallbackUrl ? { statusCallback: input.statusCallbackUrl } : {}),
    });
    const metadata = buildTwilioMessageMetadata(message);

    console.info('[sms:twilio] SMS reminder queued successfully.', metadata);

    const result = {
      provider: 'twilio' as const,
      queued: true,
      dryRun: false,
      providerMessageId: message.sid,
      providerMetadata: metadata,
      errorMessage: message.errorMessage ?? undefined,
    };

    console.info('[sms:twilio] sendSmsReminder:result', result);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Twilio SMS request failed.';
    const metadata = {
      twilio_from: config.from,
      twilio_to: input.to,
      twilio_error_message: errorMessage,
    };
    console.error('[sms:twilio] SMS reminder failed.', metadata);

    const result = {
      provider: 'twilio' as const,
      queued: false,
      dryRun: false,
      providerMessageId: null,
      providerMetadata: metadata,
      errorMessage,
    };

    console.info('[sms:twilio] sendSmsReminder:result', result);

    return result;
  }
}
