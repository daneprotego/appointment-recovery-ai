import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';

import { classifyMessagePlaceholder } from '@/lib/ai/message-classification';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getReplyStatusUpdate, getTwilioWebhookResponseMessage, parseSmsReply } from '@/lib/sms/replies';
import { getAppEnvironment } from '@/lib/types/env';
import type { Appointment, Customer, Json, Reminder } from '@/lib/types/database';
import { transitionAppointmentStatus } from '@/lib/workflows/appointment-lifecycle';
import { recordCommunicationEvent } from '@/lib/workflows/communications';

export const runtime = 'nodejs';

interface TwilioInboundSmsPayload {
  from: string;
  to: string;
  body: string;
  messageSid: string | null;
  accountSid: string | null;
}

interface ReminderMatch {
  customer: Customer;
  reminder: Reminder | null;
  appointment: Appointment | null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twimlResponse(message: string, status = 200): NextResponse {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`, {
    status,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
    },
  });
}

function parseInboundPayload(formData: Pick<URLSearchParams, 'get'>): TwilioInboundSmsPayload {
  return {
    from: String(formData.get('From') ?? ''),
    to: String(formData.get('To') ?? ''),
    body: String(formData.get('Body') ?? ''),
    messageSid: formData.get('MessageSid') ? String(formData.get('MessageSid')) : null,
    accountSid: formData.get('AccountSid') ? String(formData.get('AccountSid')) : null,
  };
}

function isEnabled(value: string): boolean {
  return value.toLowerCase() === 'true';
}

function getPhoneCandidates(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const candidates = new Set<string>([phone]);

  if (digits) {
    candidates.add(digits);
    candidates.add(`+${digits}`);
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    candidates.add(digits.slice(1));
    candidates.add(`+${digits}`);
  }

  if (digits.length === 10) {
    candidates.add(`+1${digits}`);
  }

  return Array.from(candidates);
}

function isRecord(value: Json): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function appendRecoveryNote(existing: string | null, note: string | undefined): string | null {
  if (!note) {
    return existing;
  }

  return existing ? `${existing}\n${note}` : note;
}

function buildTwilioSignature(url: string, params: URLSearchParams, authToken: string): string {
  const sortedParams = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const signatureBase = sortedParams.reduce((base, [key, value]) => `${base}${key}${value}`, url);

  return createHmac('sha1', authToken).update(signatureBase).digest('base64');
}

function getFirstForwardedHeaderValue(value: string | null): string | null {
  return value?.split(',')[0]?.trim() || null;
}

function getConfiguredPublicAppUrl(): string | null {
  return process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? null;
}

function getTwilioSignatureValidationUrl(request: NextRequest): string {
  const pathAndSearch = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const configuredPublicAppUrl = getConfiguredPublicAppUrl();

  if (configuredPublicAppUrl) {
    return new URL(pathAndSearch, configuredPublicAppUrl).toString();
  }

  const requestUrl = new URL(request.url);
  const forwardedHost = getFirstForwardedHeaderValue(request.headers.get('x-forwarded-host'));
  const forwardedProto = getFirstForwardedHeaderValue(request.headers.get('x-forwarded-proto'));
  const host = forwardedHost ?? request.headers.get('host') ?? requestUrl.host;
  const protocol = forwardedProto ?? requestUrl.protocol.replace(':', '') ?? 'https';

  return `${protocol}://${host}${pathAndSearch}`;
}

function isValidTwilioSignature(request: NextRequest, rawBody: string, authToken: string): boolean {
  const providedSignature = request.headers.get('x-twilio-signature') ?? '';

  if (!providedSignature || !authToken) {
    return false;
  }

  const validationUrl = getTwilioSignatureValidationUrl(request);
  const expectedSignature = buildTwilioSignature(validationUrl, new URLSearchParams(rawBody), authToken);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

async function findLatestReminderMatch(fromPhone: string): Promise<ReminderMatch | null> {
  const supabase = getSupabaseAdminClient();
  const { data: customers, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .in('phone', getPhoneCandidates(fromPhone));

  if (customerError) {
    throw new Error(`Unable to find customer for inbound SMS: ${customerError.message}`);
  }

  const typedCustomers = (customers ?? []) as Customer[];

  if (typedCustomers.length === 0) {
    return null;
  }

  const { data: reminder, error: reminderError } = await supabase
    .from('reminders')
    .select('*')
    .eq('channel', 'sms')
    .in(
      'customer_id',
      typedCustomers.map((customer) => customer.id),
    )
    .order('scheduled_for', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reminderError) {
    throw new Error(`Unable to find reminder for inbound SMS: ${reminderError.message}`);
  }

  const matchedReminder = reminder as Reminder | null;
  const customer = typedCustomers.find((candidate) => candidate.id === matchedReminder?.customer_id) ?? typedCustomers[0];

  if (!matchedReminder) {
    return { customer, reminder: null, appointment: null };
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', matchedReminder.appointment_id)
    .eq('business_id', customer.business_id)
    .maybeSingle();

  if (appointmentError) {
    throw new Error(`Unable to find appointment for inbound SMS: ${appointmentError.message}`);
  }

  return { customer, reminder: matchedReminder, appointment: appointment as Appointment | null };
}

async function applyInboundReply(payload: TwilioInboundSmsPayload): Promise<string> {
  const parsedReply = parseSmsReply(payload.body);
  const statusUpdate = getReplyStatusUpdate(parsedReply);
  const match = await findLatestReminderMatch(payload.from);
  const supabase = getSupabaseAdminClient();

  if (!match) {
    return getTwilioWebhookResponseMessage(parsedReply.intent);
  }

  const classification = classifyMessagePlaceholder(payload.body);

  await recordCommunicationEvent({
    businessId: match.customer.business_id,
    customerId: match.customer.id,
    appointmentId: match.appointment?.id ?? null,
    reminderId: match.reminder?.id ?? null,
    channel: 'sms',
    direction: 'inbound',
    eventType: 'reply_received',
    body: payload.body,
    providerMessageId: payload.messageSid,
    metadata: { from: payload.from, to: payload.to, parsed_intent: parsedReply.intent },
  });

  await recordCommunicationEvent({
    businessId: match.customer.business_id,
    customerId: match.customer.id,
    appointmentId: match.appointment?.id ?? null,
    reminderId: match.reminder?.id ?? null,
    channel: 'system',
    direction: 'internal',
    eventType: 'reply_classified',
    body: classification.summary,
    metadata: { ...classification, source: 'placeholder_keyword_classifier' },
  });

  const customerUpdate: Partial<Pick<Customer, 'sms_opt_in' | 'status'>> = {};

  if (statusUpdate.customerSmsOptIn !== undefined) {
    customerUpdate.sms_opt_in = statusUpdate.customerSmsOptIn;
  }

  if (statusUpdate.customerStatus !== undefined) {
    customerUpdate.status = statusUpdate.customerStatus;
  }

  if (Object.keys(customerUpdate).length > 0) {
    await supabase.from('customers').update(customerUpdate).eq('id', match.customer.id).eq('business_id', match.customer.business_id);
  }

  if (match.reminder) {
    const existingMetadata = isRecord(match.reminder.metadata) ? match.reminder.metadata : {};

    await supabase
      .from('reminders')
      .update({
        status: statusUpdate.reminderStatus ?? match.reminder.status,
        delivered_at: new Date().toISOString(),
        metadata: {
          ...existingMetadata,
          last_inbound_sms: {
            from: payload.from,
            to: payload.to,
            body: payload.body,
            normalized_body: parsedReply.normalizedBody,
            keyword: parsedReply.keyword,
            intent: parsedReply.intent,
            message_sid: payload.messageSid,
            account_sid: payload.accountSid,
            received_at: new Date().toISOString(),
          },
        },
      })
      .eq('id', match.reminder.id)
      .eq('business_id', match.customer.business_id);

    if (statusUpdate.reminderStatus === 'cancelled') {
      await supabase
        .from('reminders')
        .update({ status: 'cancelled' })
        .eq('appointment_id', match.reminder.appointment_id)
        .eq('business_id', match.customer.business_id)
        .eq('channel', 'sms')
        .eq('status', 'queued');
    }
  }

  if (match.appointment && statusUpdate.appointmentStatus) {
    await transitionAppointmentStatus({
      appointmentId: match.appointment.id,
      businessId: match.appointment.business_id,
      toStatus: statusUpdate.appointmentStatus,
      reason: statusUpdate.appointmentStatus === 'cancelled' ? 'Cancelled by SMS reply' : undefined,
      recoveryNotes: appendRecoveryNote(match.appointment.recovery_notes, statusUpdate.recoveryNotes),
    });
  }

  return getTwilioWebhookResponseMessage(parsedReply.intent);
}

export async function POST(request: NextRequest) {
  const env = getAppEnvironment();
  const rawBody = await request.text();

  if (isEnabled(env.twilioValidateWebhookSignatures) && !isValidTwilioSignature(request, rawBody, env.twilioAuthToken)) {
    return twimlResponse('Invalid Twilio signature.', 403);
  }

  const payload = parseInboundPayload(new URLSearchParams(rawBody));

  if (!payload.from || !payload.body) {
    return twimlResponse('Missing SMS sender or body.', 400);
  }

  const responseMessage = await applyInboundReply(payload);

  return twimlResponse(responseMessage);
}
