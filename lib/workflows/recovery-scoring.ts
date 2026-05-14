import type { Appointment, Customer, RecoveryOpportunityPriority } from '@/lib/types/database';

export interface RecoveryScoreContext {
  appointment: Pick<Appointment, 'starts_at' | 'value_cents' | 'status' | 'risk_level'>;
  customer: Pick<Customer, 'no_show_count' | 'lifetime_value_cents' | 'sms_opt_in' | 'phone'>;
  openWaitlistMatches?: number;
  now?: Date;
}

export interface RecoveryScoreResult {
  score: number;
  priority: RecoveryOpportunityPriority;
  reasons: string[];
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreRecoveryOpportunity(context: RecoveryScoreContext): RecoveryScoreResult {
  const now = context.now ?? new Date();
  const startsAt = new Date(context.appointment.starts_at);
  const hoursUntilStart = (startsAt.getTime() - now.getTime()) / (60 * 60 * 1000);
  const reasons: string[] = [];
  let score = 20;

  if (context.appointment.status === 'cancelled' || context.appointment.status === 'no_show') {
    score += 25;
    reasons.push('appointment already needs recovery');
  }

  if (hoursUntilStart >= 0 && hoursUntilStart <= 6) {
    score += 20;
    reasons.push('slot starts within 6 hours');
  } else if (hoursUntilStart > 6 && hoursUntilStart <= 24) {
    score += 14;
    reasons.push('slot starts within 24 hours');
  }

  if (context.appointment.value_cents >= 25000) {
    score += 18;
    reasons.push('high appointment value');
  } else if (context.appointment.value_cents >= 10000) {
    score += 10;
    reasons.push('meaningful appointment value');
  }

  if (context.customer.lifetime_value_cents >= 100000) {
    score += 12;
    reasons.push('high lifetime value customer');
  }

  if (context.customer.no_show_count > 1) {
    score += 8;
    reasons.push('customer has prior no-shows');
  }

  if (context.customer.sms_opt_in && context.customer.phone) {
    score += 8;
    reasons.push('customer can receive SMS recovery outreach');
  }

  if ((context.openWaitlistMatches ?? 0) > 0) {
    score += Math.min(17, (context.openWaitlistMatches ?? 0) * 7);
    reasons.push('waitlist demand can backfill the slot');
  }

  if (context.appointment.risk_level === 'high') {
    score += 10;
    reasons.push('appointment is already high risk');
  }

  const finalScore = clampScore(score);
  const priority: RecoveryOpportunityPriority = finalScore >= 75 ? 'urgent' : finalScore >= 55 ? 'high' : finalScore >= 35 ? 'medium' : 'low';

  return { score: finalScore, priority, reasons };
}
