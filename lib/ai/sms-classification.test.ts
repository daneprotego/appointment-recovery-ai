import assert from 'node:assert/strict';
import test from 'node:test';

import { classifySmsMessage, shouldApplyAiWorkflowAction, type SmsClassifierClient } from './sms-classification';

function output(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ intent: 'unknown', confidence: 0.8, needsHumanReview: false, summary: 'Summary', suggestedReply: null, entities: { requestedDate: null, requestedTime: null, latenessMinutes: null, reason: null }, ...overrides });
}
function client(result: string, calls = { count: 0 }): SmsClassifierClient {
  return { responses: { create: async () => { calls.count++; return { output_text: result }; } } };
}

test('STOP is deterministic opt_out and does not call OpenAI', async () => { const calls = { count: 0 }; const result = await classifySmsMessage('  stop  ', { client: client(output(), calls) }); assert.equal(result.intent, 'opt_out'); assert.equal(result.source, 'deterministic'); assert.equal(calls.count, 0); });
test('START is deterministic opt_in', async () => assert.equal((await classifySmsMessage('START', { client: client(output()) })).intent, 'opt_in'));
test('YES is deterministic confirm', async () => assert.equal((await classifySmsMessage('yes', { client: client(output()) })).intent, 'confirm'));

test('ambiguous natural language is forced to staff review', async () => { const result = await classifySmsMessage('I am not sure what to do', { client: client(output({ intent: 'unknown' })) }); assert.equal(result.needsHumanReview, true); });
test('natural-language cancellation can pass the safe action threshold', async () => { const result = await classifySmsMessage('I need to cancel because I am ill', { client: client(output({ intent: 'cancel', confidence: 0.96, entities: { requestedDate: null, requestedTime: null, latenessMinutes: null, reason: 'illness' } })) }); assert.equal(shouldApplyAiWorkflowAction(result), true); });
test('natural-language reschedule extracts an ISO date', async () => { const result = await classifySmsMessage('Could we move it to August 5?', { client: client(output({ intent: 'reschedule', confidence: 0.94, entities: { requestedDate: '2026-08-05', requestedTime: null, latenessMinutes: null, reason: null } })) }); assert.equal(result.entities.requestedDate, '2026-08-05'); });
test('lateness message captures minutes', async () => { const result = await classifySmsMessage('Running 15 minutes late', { client: client(output({ intent: 'late', confidence: 0.98, entities: { requestedDate: null, requestedTime: null, latenessMinutes: 15, reason: null } })) }); assert.equal(result.entities.latenessMinutes, 15); });
test('low confidence forces review and cannot mutate workflow', async () => { const result = await classifySmsMessage('please cancel maybe', { client: client(output({ intent: 'cancel', confidence: 0.74 })) }); assert.equal(result.needsHumanReview, true); assert.equal(shouldApplyAiWorkflowAction(result), false); });
test('unknown cannot mutate workflow', async () => { const result = await classifySmsMessage('something', { client: client(output()) }); assert.equal(shouldApplyAiWorkflowAction(result), false); });
test('invalid structured output falls back safely', async () => { const result = await classifySmsMessage('hello there', { client: client('{"intent":"cancel"}') }); assert.equal(result.source, 'fallback'); assert.equal(result.intent, 'unknown'); assert.equal(result.needsHumanReview, true); });
test('provider errors fall back safely', async () => { const failing: SmsClassifierClient = { responses: { create: async () => { throw new Error('provider unavailable'); } } }; const result = await classifySmsMessage('hello', { client: failing }); assert.equal(result.source, 'fallback'); });
test('timeout falls back safely', async () => { const hanging: SmsClassifierClient = { responses: { create: (_body, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('aborted')))) } }; const result = await classifySmsMessage('hello', { client: hanging, timeoutMs: 5 }); assert.equal(result.source, 'fallback'); });
test('confidence is clamped to zero and one', async () => { assert.equal((await classifySmsMessage('hello', { client: client(output({ intent: 'gratitude', confidence: 4 })) })).confidence, 1); assert.equal((await classifySmsMessage('hello', { client: client(output({ confidence: -2 })) })).confidence, 0); });
test('suggested replies are limited to 320 characters', async () => { const result = await classifySmsMessage('thanks', { client: client(output({ intent: 'gratitude', confidence: 0.99, suggestedReply: 'x'.repeat(500) })) }); assert.equal(result.suggestedReply?.length, 320); });
