import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';

import { classifyMessagePlaceholder } from '@/lib/ai/message-classification';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getReplyStatusUpdate, getTwilioWebhookResponseMessage, parseSmsReply } from '@/lib/sms/replies';
import type { Appointment, CommunicationEvent, Customer, Json, RecoveryOpportunity, Reminder, WaitlistEntry } from '@/lib/types/database';
import { getAppEnvironment } from '@/lib/types/env';
import { transitionAppointmentStatus } from '@/lib/workflows/appointment-lifecycle';
import { recordCommunicationEvent } from '@/lib/workflows/communications';

export const runtime = 'nodejs';

type WaitlistReplyIntent = 'claim' | 'cancel' | 'reschedule' | 'stop' | 'help' | 'default';

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

function escapeXml(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function twimlResponse(message: string, status = 200): NextResponse { return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`, { status, headers: { 'Content-Type': 'text/xml; charset=utf-8' } }); }
function parseInboundPayload(formData: Pick<URLSearchParams, 'get'>): TwilioInboundSmsPayload { return { from: String(formData.get('From') ?? ''), to: String(formData.get('To') ?? ''), body: String(formData.get('Body') ?? ''), messageSid: formData.get('MessageSid') ? String(formData.get('MessageSid')) : null, accountSid: formData.get('AccountSid') ? String(formData.get('AccountSid')) : null }; }
function isEnabled(value: string): boolean { return value.toLowerCase() === 'true'; }
function getPhoneCandidates(phone: string): string[] { const digits = phone.replace(/\D/g, ''); const candidates = new Set<string>([phone]); if (digits) { candidates.add(digits); candidates.add(`+${digits}`);} if (digits.length===11&&digits.startsWith('1')) { candidates.add(digits.slice(1)); candidates.add(`+${digits}`);} if (digits.length===10) { candidates.add(`+1${digits}`);} return Array.from(candidates); }
function isRecord(value: Json): value is Record<string, Json | undefined> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function appendRecoveryNote(existing: string | null, note: string | undefined): string | null { if (!note) return existing; return existing ? `${existing}\n${note}` : note; }
function buildTwilioSignature(url: string, params: URLSearchParams, authToken: string): string { const sortedParams = Array.from(params.entries()).sort(([a],[b])=>a.localeCompare(b)); const signatureBase = sortedParams.reduce((base,[key,value])=>`${base}${key}${value}`,url); return createHmac('sha1', authToken).update(signatureBase).digest('base64'); }
function getFirstForwardedHeaderValue(value: string | null): string | null { return value?.split(',')[0]?.trim() || null; }
function getConfiguredPublicAppUrl(): string | null { return process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? null; }
function getTwilioSignatureValidationUrl(request: NextRequest): string { const pathAndSearch = `${request.nextUrl.pathname}${request.nextUrl.search}`; const configuredPublicAppUrl = getConfiguredPublicAppUrl(); if (configuredPublicAppUrl) return new URL(pathAndSearch, configuredPublicAppUrl).toString(); const requestUrl = new URL(request.url); const forwardedHost = getFirstForwardedHeaderValue(request.headers.get('x-forwarded-host')); const forwardedProto = getFirstForwardedHeaderValue(request.headers.get('x-forwarded-proto')); const host = forwardedHost ?? request.headers.get('host') ?? requestUrl.host; const protocol = forwardedProto ?? requestUrl.protocol.replace(':', '') ?? 'https'; return `${protocol}://${host}${pathAndSearch}`; }
function isValidTwilioSignature(request: NextRequest, rawBody: string, authToken: string): boolean { const providedSignature = request.headers.get('x-twilio-signature') ?? ''; if (!providedSignature || !authToken) return false; const validationUrl = getTwilioSignatureValidationUrl(request); const expectedSignature = buildTwilioSignature(validationUrl, new URLSearchParams(rawBody), authToken); const providedBuffer = Buffer.from(providedSignature); const expectedBuffer = Buffer.from(expectedSignature); return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer); }

function getWaitlistReplyIntent(body: string): WaitlistReplyIntent {
  const normalized = body.trim().toUpperCase();
  if (['YES', 'CONFIRM', 'CLAIM'].includes(normalized)) return 'claim';
  if (normalized === 'CANCEL') return 'cancel';
  if (normalized === 'RESCHEDULE') return 'reschedule';
  if (normalized === 'STOP') return 'stop';
  if (normalized === 'HELP') return 'help';
  return 'default';
}

async function findLatestReminderMatch(fromPhone: string): Promise<ReminderMatch | null> { /* unchanged logic */
  const supabase = getSupabaseAdminClient();
  const { data: customers, error: customerError } = await supabase.from('customers').select('*').in('phone', getPhoneCandidates(fromPhone));
  if (customerError) throw new Error(`Unable to find customer for inbound SMS: ${customerError.message}`);
  const typedCustomers = (customers ?? []) as Customer[];
  if (typedCustomers.length === 0) return null;
  const { data: reminder, error: reminderError } = await supabase.from('reminders').select('*').eq('channel', 'sms').in('customer_id', typedCustomers.map((c) => c.id)).order('scheduled_for', { ascending: false }).limit(1).maybeSingle();
  if (reminderError) throw new Error(`Unable to find reminder for inbound SMS: ${reminderError.message}`);
  const matchedReminder = reminder as Reminder | null;
  const customer = typedCustomers.find((candidate) => candidate.id === matchedReminder?.customer_id) ?? typedCustomers[0];
  if (!matchedReminder) return { customer, reminder: null, appointment: null };
  const { data: appointment, error: appointmentError } = await supabase.from('appointments').select('*').eq('id', matchedReminder.appointment_id).eq('business_id', customer.business_id).maybeSingle();
  if (appointmentError) throw new Error(`Unable to find appointment for inbound SMS: ${appointmentError.message}`);
  return { customer, reminder: matchedReminder, appointment: appointment as Appointment | null };
}

async function findLatestWaitlistOffer(customerId: string): Promise<CommunicationEvent | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('communication_events')
    .select('*')
    .eq('customer_id', customerId)
    .eq('event_type', 'waitlist_offer')
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Unable to find latest waitlist offer: ${error.message}`);
  return (data as CommunicationEvent | null) ?? null;
}

async function handleClaimReply(match: ReminderMatch, payload: TwilioInboundSmsPayload): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const latestOffer = await findLatestWaitlistOffer(match.customer.id);
  const offerMetadata = latestOffer && isRecord(latestOffer.metadata) ? latestOffer.metadata : null;
  const waitlistEntryId = offerMetadata && typeof offerMetadata.waitlist_entry_id === 'string' ? offerMetadata.waitlist_entry_id : null;
  const appointmentId = offerMetadata && typeof offerMetadata.appointment_id === 'string' ? offerMetadata.appointment_id : latestOffer?.appointment_id ?? null;

  if (!latestOffer || !waitlistEntryId || !appointmentId) return 'Sorry, we could not find an active offer to claim. Please contact support.';

  const [{ data: appointment }, { data: waitlistEntry }, { data: opportunity }] = await Promise.all([
    supabase.from('appointments').select('*').eq('id', appointmentId).eq('business_id', match.customer.business_id).maybeSingle<Appointment>(),
    supabase.from('waitlists').select('*').eq('id', waitlistEntryId).eq('business_id', match.customer.business_id).maybeSingle<WaitlistEntry>(),
    supabase.from('recovery_opportunities').select('*').eq('appointment_id', appointmentId).eq('business_id', match.customer.business_id).order('created_at', { ascending: false }).limit(1).maybeSingle<RecoveryOpportunity>(),
  ]);

  if (!appointment || !['cancelled', 'no_show'].includes(appointment.status)) return 'Thanks! That slot is no longer available. We will notify you if another opening comes up.';
  if (!waitlistEntry || waitlistEntry.customer_id !== match.customer.id || !['notified', 'open'].includes(waitlistEntry.status)) return 'Thanks! This offer is no longer available.';

  const { data: claimedEntry, error: claimError } = await supabase
    .from('waitlists')
    .update({ status: 'booked', matched_appointment_id: appointment.id, metadata: { ...(isRecord(waitlistEntry.metadata) ? waitlistEntry.metadata : {}), claimed_at: new Date().toISOString(), claimed_via: 'sms_reply' } })
    .eq('id', waitlistEntry.id)
    .eq('business_id', match.customer.business_id)
    .in('status', ['notified', 'open'])
    .select('*')
    .maybeSingle<WaitlistEntry>();
  if (claimError) throw new Error(`Unable to claim waitlist entry: ${claimError.message}`);
  if (!claimedEntry) return 'Thanks! This slot was just claimed by someone else.';

  if (opportunity && opportunity.status !== 'recovered') {
    await supabase.from('recovery_opportunities').update({ status: 'recovered', resolved_at: new Date().toISOString(), recovered_value_cents: opportunity.estimated_value_cents, reason: appendRecoveryNote(opportunity.reason, 'Recovered via inbound SMS claim.') }).eq('id', opportunity.id).eq('business_id', match.customer.business_id);
  }

  await recordCommunicationEvent({ businessId: match.customer.business_id, customerId: match.customer.id, appointmentId: appointment.id, reminderId: match.reminder?.id ?? null, channel: 'sms', direction: 'inbound', eventType: 'reply_received', body: payload.body, providerMessageId: payload.messageSid, metadata: { from: payload.from, to: payload.to, intent: 'claim', waitlist_entry_id: waitlistEntry.id } });
  return 'Great news — your spot is claimed! We will follow up with confirmation details shortly.';
}

async function applyInboundReply(payload: TwilioInboundSmsPayload): Promise<string> {
  const match = await findLatestReminderMatch(payload.from);
  if (!match) return getTwilioWebhookResponseMessage(parseSmsReply(payload.body).intent);
  const supabase = getSupabaseAdminClient();
  const intent = getWaitlistReplyIntent(payload.body);

  if (intent === 'claim') return handleClaimReply(match, payload);
  if (intent === 'cancel' || intent === 'reschedule') {
    await recordCommunicationEvent({ businessId: match.customer.business_id, customerId: match.customer.id, appointmentId: match.appointment?.id ?? null, reminderId: match.reminder?.id ?? null, channel: 'sms', direction: 'inbound', eventType: 'reply_received', body: payload.body, providerMessageId: payload.messageSid, metadata: { from: payload.from, to: payload.to, intent } });
    return intent === 'cancel' ? 'Understood. We have noted your cancellation request. Reply HELP if you need assistance.' : 'Thanks! We have noted your reschedule request and will contact you with options.';
  }
  if (intent === 'stop') {
    await supabase.from('customers').update({ sms_opt_in: false }).eq('id', match.customer.id).eq('business_id', match.customer.business_id);
    await recordCommunicationEvent({ businessId: match.customer.business_id, customerId: match.customer.id, appointmentId: match.appointment?.id ?? null, reminderId: match.reminder?.id ?? null, channel: 'sms', direction: 'inbound', eventType: 'status_change', body: 'Customer opted out via STOP reply.', providerMessageId: payload.messageSid, metadata: { from: payload.from, to: payload.to, opt_out: true } });
    return 'You are opted out and will no longer receive SMS messages. Reply START to re-subscribe.';
  }
  if (intent === 'help') return 'Need help? Reply with your question or contact support at support@example.com.';

  // preserve existing behavior for non-keyword replies
  const parsedReply = parseSmsReply(payload.body);
  const statusUpdate = getReplyStatusUpdate(parsedReply);
  const classification = classifyMessagePlaceholder(payload.body);

  await recordCommunicationEvent({ businessId: match.customer.business_id, customerId: match.customer.id, appointmentId: match.appointment?.id ?? null, reminderId: match.reminder?.id ?? null, channel: 'sms', direction: 'inbound', eventType: 'reply_received', body: payload.body, providerMessageId: payload.messageSid, metadata: { from: payload.from, to: payload.to, parsed_intent: parsedReply.intent } });
  await recordCommunicationEvent({ businessId: match.customer.business_id, customerId: match.customer.id, appointmentId: match.appointment?.id ?? null, reminderId: match.reminder?.id ?? null, channel: 'system', direction: 'internal', eventType: 'reply_classified', body: classification.summary, metadata: { ...classification, source: 'placeholder_keyword_classifier' } });

  const customerUpdate: Partial<Pick<Customer, 'sms_opt_in' | 'status'>> = {};
  if (statusUpdate.customerSmsOptIn !== undefined) customerUpdate.sms_opt_in = statusUpdate.customerSmsOptIn;
  if (statusUpdate.customerStatus !== undefined) customerUpdate.status = statusUpdate.customerStatus;
  if (Object.keys(customerUpdate).length > 0) await supabase.from('customers').update(customerUpdate).eq('id', match.customer.id).eq('business_id', match.customer.business_id);

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
  if (isEnabled(env.twilioValidateWebhookSignatures) && !isValidTwilioSignature(request, rawBody, env.twilioAuthToken)) return twimlResponse('Invalid Twilio signature.', 403);
  const payload = parseInboundPayload(new URLSearchParams(rawBody));
  if (!payload.from || !payload.body) return twimlResponse('Missing SMS sender or body.', 400);
  return twimlResponse(await applyInboundReply(payload));
}
