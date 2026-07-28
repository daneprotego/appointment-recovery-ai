import OpenAI from 'openai';

export const SMS_INTENTS = ['confirm', 'cancel', 'reschedule', 'late', 'question', 'human_help', 'opt_out', 'opt_in', 'decline', 'gratitude', 'unknown'] as const;
export type SmsClassificationIntent = (typeof SMS_INTENTS)[number];
export type SmsClassificationSource = 'deterministic' | 'openai' | 'fallback';

export interface SmsClassificationContext {
  businessName?: string | null;
  customerFirstName?: string | null;
  appointmentServiceName?: string | null;
  appointmentStartsAt?: string | null;
  appointmentStatus?: string | null;
  priorOutboundReminderText?: string | null;
  businessTimezone?: string | null;
}

export interface SmsClassification {
  intent: SmsClassificationIntent;
  confidence: number;
  needsHumanReview: boolean;
  summary: string;
  suggestedReply: string | null;
  entities: { requestedDate: string | null; requestedTime: string | null; latenessMinutes: number | null; reason: string | null };
  source: SmsClassificationSource;
  model: string | null;
  classifiedAt: string;
}

type StructuredClassification = Omit<SmsClassification, 'source' | 'model' | 'classifiedAt'>;
export interface SmsClassifierClient {
  responses: { create: (body: unknown, options?: { signal?: AbortSignal }) => Promise<{ output_text?: string }> };
}
export interface ClassifySmsOptions {
  context?: SmsClassificationContext;
  client?: SmsClassifierClient;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  now?: () => Date;
}

const EXACT_COMMANDS: Record<string, SmsClassificationIntent> = {
  STOP: 'opt_out', STOPALL: 'opt_out', UNSUBSCRIBE: 'opt_out', CANCELALL: 'opt_out', END: 'opt_out', QUIT: 'opt_out',
  START: 'opt_in', UNSTOP: 'opt_in', HELP: 'human_help', INFO: 'human_help', YES: 'confirm', Y: 'confirm', CONFIRM: 'confirm',
  CONFIRMED: 'confirm', CANCEL: 'cancel', RESCHEDULE: 'reschedule', NO: 'decline', N: 'decline', DECLINE: 'decline',
};
const EMPTY_ENTITIES = { requestedDate: null, requestedTime: null, latenessMinutes: null, reason: null } as const;
const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_TIMEOUT_MS = 5_000;

function normalizedCommand(message: string): string { return message.trim().replace(/\s+/g, ' ').toUpperCase(); }
function concise(value: unknown, max: number): string { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function fallback(now: () => Date): SmsClassification {
  return { intent: 'unknown', confidence: 0, needsHumanReview: true, summary: 'Unable to classify automatically; staff review required.', suggestedReply: 'Thanks for your message. A staff member will review it and follow up.', entities: { ...EMPTY_ENTITIES }, source: 'fallback', model: null, classifiedAt: now().toISOString() };
}

export function classifyDeterministicSmsCommand(message: string, now: () => Date = () => new Date()): SmsClassification | null {
  const intent = EXACT_COMMANDS[normalizedCommand(message)];
  if (!intent) return null;
  const review = intent === 'human_help';
  return { intent, confidence: 1, needsHumanReview: review, summary: `Customer sent the ${normalizedCommand(message)} command.`, suggestedReply: review ? 'A staff member will follow up to help with your question.' : null, entities: { ...EMPTY_ENTITIES }, source: 'deterministic', model: null, classifiedAt: now().toISOString() };
}

const schema = {
  type: 'object', additionalProperties: false,
  required: ['intent', 'confidence', 'needsHumanReview', 'summary', 'suggestedReply', 'entities'],
  properties: {
    intent: { type: 'string', enum: SMS_INTENTS }, confidence: { type: 'number' }, needsHumanReview: { type: 'boolean' },
    summary: { type: 'string' }, suggestedReply: { type: ['string', 'null'] },
    entities: { type: 'object', additionalProperties: false, required: ['requestedDate', 'requestedTime', 'latenessMinutes', 'reason'], properties: {
      requestedDate: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, requestedTime: { type: ['string', 'null'], pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
      latenessMinutes: { type: ['integer', 'null'], minimum: 0 }, reason: { type: ['string', 'null'] },
    } },
  },
} as const;

function validate(value: unknown): StructuredClassification | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>; const e = v.entities as Record<string, unknown> | null;
  if (!SMS_INTENTS.includes(v.intent as SmsClassificationIntent) || typeof v.confidence !== 'number' || !Number.isFinite(v.confidence) || typeof v.needsHumanReview !== 'boolean' || typeof v.summary !== 'string' || !(v.suggestedReply === null || typeof v.suggestedReply === 'string') || !e) return null;
  const date = e.requestedDate; const time = e.requestedTime; const late = e.latenessMinutes; const reason = e.reason;
  if (!(date === null || (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))) || !(time === null || (typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time))) || !(late === null || (Number.isInteger(late) && (late as number) >= 0)) || !(reason === null || typeof reason === 'string')) return null;
  return { intent: v.intent as SmsClassificationIntent, confidence: v.confidence, needsHumanReview: v.needsHumanReview, summary: concise(v.summary, 240), suggestedReply: v.suggestedReply === null ? null : concise(v.suggestedReply, 320), entities: { requestedDate: date as string | null, requestedTime: time as string | null, latenessMinutes: late as number | null, reason: reason === null ? null : concise(reason, 160) } };
}

export async function classifySmsMessage(message: string, options: ClassifySmsOptions = {}): Promise<SmsClassification> {
  const now = options.now ?? (() => new Date());
  const deterministic = classifyDeterministicSmsCommand(message, now);
  if (deterministic) return deterministic;
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey && !options.client) return fallback(now);
  const model = options.model ?? process.env.OPENAI_SMS_CLASSIFICATION_MODEL ?? DEFAULT_MODEL;
  const client = options.client ?? new OpenAI({ apiKey, maxRetries: 1 });
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await client.responses.create({ model, instructions: 'Classify only the supplied SMS using only its limited appointment context. Never invent dates, times, or facts; use unknown when evidence is insufficient. Set needsHumanReview for ambiguity, low confidence, medical/legal/payment questions, threats, complaints, or staff judgment. Do not give sensitive or diagnostic advice. Suggested replies must be concise appointment-operations replies, contain no marketing, never promise a new time, never claim cancellation/rescheduling is complete, and say staff will follow up when review is needed.', input: JSON.stringify({ smsText: message, appointmentContext: options.context ?? {} }), text: { format: { type: 'json_schema', name: 'sms_classification', strict: true, schema } } }, { signal: controller.signal });
    const parsed = validate(JSON.parse(response.output_text ?? ''));
    if (!parsed) return fallback(now);
    const confidence = Math.min(1, Math.max(0, parsed.confidence));
    const needsHumanReview = parsed.needsHumanReview || confidence < 0.75 || ['unknown', 'human_help', 'question'].includes(parsed.intent);
    let suggestedReply = parsed.suggestedReply;
    if (suggestedReply && needsHumanReview && !/staff|team|someone|we(?:'|’)ll follow up/i.test(suggestedReply)) suggestedReply = 'Thanks for your message. A staff member will review it and follow up.';
    return { ...parsed, confidence, needsHumanReview, suggestedReply: suggestedReply?.slice(0, 320) ?? null, source: 'openai', model, classifiedAt: now().toISOString() };
  } catch (error) {
    console.error('OpenAI SMS classification failed', { name: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message.slice(0, 160) : 'Unknown provider error' });
    return fallback(now);
  } finally { clearTimeout(timer); }
}

/** Metadata convention used by staff-review queries on reply_classified events. */
export function classificationNeedsStaffReview(metadata: unknown): boolean { return Boolean(metadata && typeof metadata === 'object' && (metadata as Record<string, unknown>).needs_human_review === true); }

export function shouldApplyAiWorkflowAction(classification: SmsClassification): boolean {
  return classification.source === 'openai' && classification.confidence >= 0.9 && !classification.needsHumanReview && (classification.intent === 'cancel' || classification.intent === 'reschedule');
}
