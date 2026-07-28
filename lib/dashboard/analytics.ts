import type { AppointmentStatus, CommunicationEventType, RecoveryOpportunityStatus } from '@/lib/types/database';

export const DASHBOARD_RANGES = [7, 30, 90] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export interface AnalyticsAppointment {
  id: string;
  startsAt: string;
  status: AppointmentStatus;
}

export interface AnalyticsOpportunity {
  id: string;
  status: RecoveryOpportunityStatus;
  createdAt: string;
  resolvedAt: string | null;
  estimatedValueCents: number;
  recoveredValueCents: number;
}

export interface AnalyticsActivity {
  id: string;
  eventType: CommunicationEventType;
  occurredAt: string;
  customerName: string | null;
  appointmentName: string | null;
}

export interface PeriodBounds {
  start: Date;
  end: Date;
  priorStart: Date;
  priorEnd: Date;
}

export interface PeriodMetrics {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShows: number;
  recoveredAppointments: number;
  recoveryRate: number;
  revenueAtRiskCents: number;
  recoveredRevenueCents: number;
}

export interface DailyBucket {
  date: string;
  appointments: number;
  disruptions: number;
  recoveredOpportunities: number;
  recoveredRevenueCents: number;
}

export function parseDashboardRange(value: string | string[] | undefined): DashboardRange {
  const parsed = typeof value === 'string' ? Number(value) : 30;
  return DASHBOARD_RANGES.includes(parsed as DashboardRange) ? parsed as DashboardRange : 30;
}

export function getPeriodBounds(days: DashboardRange, now = new Date()): PeriodBounds {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const priorEnd = new Date(start);
  const priorStart = new Date(priorEnd);
  priorStart.setUTCDate(priorStart.getUTCDate() - days);
  return { start, end, priorStart, priorEnd };
}

function isWithin(value: string | null, start: Date, end: Date) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return timestamp >= start.getTime() && timestamp < end.getTime();
}

export function calculatePeriodMetrics(
  appointments: AnalyticsAppointment[],
  opportunities: AnalyticsOpportunity[],
  start: Date,
  end: Date,
): PeriodMetrics {
  const periodAppointments = appointments.filter((item) => isWithin(item.startsAt, start, end));
  const createdOpportunities = opportunities.filter((item) => isWithin(item.createdAt, start, end));
  const resolvedOpportunities = opportunities.filter(
    (item) => (item.status === 'recovered' || item.status === 'lost') && isWithin(item.resolvedAt, start, end),
  );
  const recovered = resolvedOpportunities.filter((item) => item.status === 'recovered');

  return {
    totalAppointments: periodAppointments.length,
    completedAppointments: periodAppointments.filter((item) => item.status === 'completed').length,
    cancelledAppointments: periodAppointments.filter((item) => item.status === 'cancelled').length,
    noShows: periodAppointments.filter((item) => item.status === 'no_show').length,
    recoveredAppointments: recovered.length,
    recoveryRate: resolvedOpportunities.length === 0 ? 0 : recovered.length / resolvedOpportunities.length,
    revenueAtRiskCents: createdOpportunities.reduce((sum, item) => sum + item.estimatedValueCents, 0),
    recoveredRevenueCents: recovered.reduce((sum, item) => sum + item.recoveredValueCents, 0),
  };
}

export function comparisonText(current: number, prior: number, days: number, options?: { percentagePoints?: boolean }) {
  if (prior === 0) return current === 0 ? 'No change' : 'Not enough prior data';
  if (current === prior) return 'No change';
  if (options?.percentagePoints) {
    const points = Math.round((current - prior) * 1000) / 10;
    return `${points > 0 ? '+' : ''}${points}% pts vs previous ${days} days`;
  }
  const change = Math.round(((current - prior) / Math.abs(prior)) * 100);
  return `${change > 0 ? '+' : ''}${change}% vs previous ${days} days`;
}

export function generateDailyBuckets(
  days: DashboardRange,
  start: Date,
  appointments: AnalyticsAppointment[],
  opportunities: AnalyticsOpportunity[],
): DailyBucket[] {
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), appointments: 0, disruptions: 0, recoveredOpportunities: 0, recoveredRevenueCents: 0 };
  });
  const byDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));
  for (const appointment of appointments) {
    const bucket = byDate.get(appointment.startsAt.slice(0, 10));
    if (!bucket) continue;
    bucket.appointments += 1;
    if (appointment.status === 'cancelled' || appointment.status === 'no_show') bucket.disruptions += 1;
  }
  for (const opportunity of opportunities) {
    if (opportunity.status !== 'recovered' || !opportunity.resolvedAt) continue;
    const bucket = byDate.get(opportunity.resolvedAt.slice(0, 10));
    if (!bucket) continue;
    bucket.recoveredOpportunities += 1;
    bucket.recoveredRevenueCents += opportunity.recoveredValueCents;
  }
  return buckets;
}

export const ACTIVITY_LABELS: Record<CommunicationEventType, string> = {
  reminder_scheduled: 'Reminder scheduled', reminder_sent: 'Reminder sent', reminder_delivered: 'Reminder delivered',
  reply_received: 'Customer reply received', reply_classified: 'Reply classified', status_change: 'Appointment status changed',
  waitlist_offer: 'Waitlist offer sent', recovery_note: 'Recovery note added',
};
