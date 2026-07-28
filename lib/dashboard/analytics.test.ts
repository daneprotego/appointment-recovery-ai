import assert from 'node:assert/strict';
import test from 'node:test';

import { calculatePeriodMetrics, comparisonText, generateDailyBuckets, parseDashboardRange } from './analytics';
import type { AnalyticsAppointment, AnalyticsOpportunity } from './analytics';

const start = new Date('2026-07-01T00:00:00.000Z');
const end = new Date('2026-07-08T00:00:00.000Z');

const appointments: AnalyticsAppointment[] = [
  { id: '1', startsAt: '2026-07-01T10:00:00.000Z', status: 'completed' },
  { id: '2', startsAt: '2026-07-02T10:00:00.000Z', status: 'cancelled' },
  { id: '3', startsAt: '2026-07-02T12:00:00.000Z', status: 'no_show' },
];
const opportunities: AnalyticsOpportunity[] = [
  { id: '1', status: 'recovered', createdAt: '2026-07-01T09:00:00.000Z', resolvedAt: '2026-07-03T09:00:00.000Z', estimatedValueCents: 12000, recoveredValueCents: 9000 },
  { id: '2', status: 'lost', createdAt: '2026-07-02T09:00:00.000Z', resolvedAt: '2026-07-04T09:00:00.000Z', estimatedValueCents: 8000, recoveredValueCents: 0 },
];

test('empty data and zero denominators return zero metrics', () => {
  assert.deepEqual(calculatePeriodMetrics([], [], start, end), {
    totalAppointments: 0, completedAppointments: 0, cancelledAppointments: 0, noShows: 0,
    recoveredAppointments: 0, recoveryRate: 0, revenueAtRiskCents: 0, recoveredRevenueCents: 0,
  });
});

test('calculates recovery rate and integer-cent revenue totals', () => {
  const metrics = calculatePeriodMetrics(appointments, opportunities, start, end);
  assert.equal(metrics.recoveryRate, 0.5);
  assert.equal(metrics.revenueAtRiskCents, 20000);
  assert.equal(metrics.recoveredRevenueCents, 9000);
  assert.equal(metrics.totalAppointments, 3);
});

test('formats safe current versus prior comparisons', () => {
  assert.equal(comparisonText(112, 100, 30), '+12% vs previous 30 days');
  assert.equal(comparisonText(0, 0, 30), 'No change');
  assert.equal(comparisonText(10, 0, 30), 'Not enough prior data');
  assert.equal(comparisonText(0.6, 0.5, 30, { percentagePoints: true }), '+10% pts vs previous 30 days');
});

test('generates complete daily buckets including empty days', () => {
  const buckets = generateDailyBuckets(7, start, appointments, opportunities);
  assert.equal(buckets.length, 7);
  assert.deepEqual(buckets[0], { date: '2026-07-01', appointments: 1, disruptions: 0, recoveredOpportunities: 0, recoveredRevenueCents: 0 });
  assert.equal(buckets[1].disruptions, 2);
  assert.equal(buckets[2].recoveredOpportunities, 1);
  assert.equal(buckets[2].recoveredRevenueCents, 9000);
  assert.equal(buckets[6].appointments, 0);
});

test('validates dashboard ranges and defaults invalid values to 30', () => {
  assert.equal(parseDashboardRange('7'), 7);
  assert.equal(parseDashboardRange('90'), 90);
  assert.equal(parseDashboardRange('12'), 30);
  assert.equal(parseDashboardRange(['7']), 30);
});
