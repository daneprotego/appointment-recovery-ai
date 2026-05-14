export type MessageIntent = 'confirm' | 'cancel' | 'reschedule' | 'question' | 'human_help' | 'unknown';

export interface MessageClassification {
  intent: MessageIntent;
  confidence: number;
  needsHumanReview: boolean;
  summary: string;
}

export function classifyMessagePlaceholder(message: string): MessageClassification {
  const normalized = message.toLowerCase();

  if (normalized.includes('cancel')) {
    return { intent: 'cancel', confidence: 0.7, needsHumanReview: false, summary: 'Customer appears to be cancelling.' };
  }

  if (normalized.includes('reschedule') || normalized.includes('another time')) {
    return { intent: 'reschedule', confidence: 0.7, needsHumanReview: false, summary: 'Customer appears to need a new time.' };
  }

  if (normalized.includes('yes') || normalized.includes('confirm')) {
    return { intent: 'confirm', confidence: 0.65, needsHumanReview: false, summary: 'Customer appears to confirm.' };
  }

  return { intent: 'unknown', confidence: 0.3, needsHumanReview: true, summary: 'OpenAI classification placeholder: route to staff until OPENAI_API_KEY is configured.' };
}
