import Link from 'next/link';

import { requireOnboardedSession } from '@/lib/auth/session';
import {
  ACTIVITY_LABELS, calculatePeriodMetrics, comparisonText, generateDailyBuckets, getPeriodBounds, parseDashboardRange,
  type DailyBucket, type PeriodMetrics,
} from '@/lib/dashboard/analytics';
import { getDashboardAnalyticsRows } from '@/lib/dashboard/analytics-data';
import { formatCurrency, formatDateTime } from '@/lib/dashboard/format';
import type { AppointmentStatus, RecoveryOpportunityStatus } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show', rescheduled: 'Rescheduled',
};
const pipelineLabels: Record<RecoveryOpportunityStatus, string> = {
  open: 'Open', contacted: 'Contacted', recovered: 'Recovered', lost: 'Lost', expired: 'Expired',
};

function TrendChart({ buckets }: Readonly<{ buckets: DailyBucket[] }>) {
  const width = 900; const height = 260; const pad = 28;
  const maxCount = Math.max(1, ...buckets.flatMap((bucket) => [bucket.appointments, bucket.disruptions, bucket.recoveredOpportunities]));
  const maxRevenue = Math.max(1, ...buckets.map((bucket) => bucket.recoveredRevenueCents));
  const points = (key: 'appointments' | 'disruptions' | 'recoveredOpportunities' | 'recoveredRevenueCents', max: number) => buckets.map((bucket, index) => {
    const x = pad + (index / Math.max(1, buckets.length - 1)) * (width - pad * 2);
    const y = height - pad - (bucket[key] / max) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const series = [
    { label: 'Appointments', color: '#2563eb', points: points('appointments', maxCount) },
    { label: 'Cancellations + no-shows', color: '#e11d48', points: points('disruptions', maxCount) },
    { label: 'Recovered opportunities', color: '#059669', points: points('recoveredOpportunities', maxCount) },
    { label: 'Recovered revenue', color: '#7c3aed', points: points('recoveredRevenueCents', maxRevenue) },
  ];
  return (
    <div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
        {series.map((item) => <span key={item.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>)}
      </div>
      <div className="mt-5 overflow-hidden" role="img" aria-label="Daily appointments, disruptions, recovered opportunities, and recovered revenue trend">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((line) => <line key={line} x1={pad} x2={width - pad} y1={pad + line * 51} y2={pad + line * 51} stroke="#e2e8f0" />)}
          {series.map((item) => <polyline key={item.label} points={item.points} fill="none" stroke={item.color} strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
        </svg>
      </div>
      <div className="flex justify-between text-xs text-slate-500"><span>{new Date(`${buckets[0]?.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span><span>{new Date(`${buckets.at(-1)?.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span></div>
      <p className="mt-3 text-xs text-slate-500">Count series use the left scale (maximum {maxCount}); recovered revenue uses its own scale (maximum {formatCurrency(maxRevenue)}).</p>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: Readonly<{ searchParams: Promise<{ range?: string | string[] }> }>) {
  const params = await searchParams;
  const range = parseDashboardRange(params.range);
  const bounds = getPeriodBounds(range);
  const session = await requireOnboardedSession();
  const data = await getDashboardAnalyticsRows(session.business.id, bounds);
  const current = calculatePeriodMetrics(data.appointments, data.opportunities, bounds.start, bounds.end);
  const prior = calculatePeriodMetrics(data.appointments, data.opportunities, bounds.priorStart, bounds.priorEnd);
  const periodAppointments = data.appointments.filter((item) => new Date(item.startsAt) >= bounds.start && new Date(item.startsAt) < bounds.end);
  const periodOpportunities = data.opportunities.filter((item) => new Date(item.createdAt) >= bounds.start && new Date(item.createdAt) < bounds.end);
  const kpis: Array<{ label: string; key: keyof PeriodMetrics; display: (value: number) => string; points?: boolean }> = [
    { label: 'Total appointments', key: 'totalAppointments', display: String },
    { label: 'Completed appointments', key: 'completedAppointments', display: String },
    { label: 'Cancelled appointments', key: 'cancelledAppointments', display: String },
    { label: 'No-shows', key: 'noShows', display: String },
    { label: 'Recovered appointments', key: 'recoveredAppointments', display: String },
    { label: 'Recovery rate', key: 'recoveryRate', display: (value) => `${Math.round(value * 1000) / 10}%`, points: true },
    { label: 'Revenue at risk', key: 'revenueAtRiskCents', display: formatCurrency },
    { label: 'Recovered revenue', key: 'recoveredRevenueCents', display: formatCurrency },
  ];
  const statusBreakdown = (Object.keys(statusLabels) as AppointmentStatus[]).map((status) => ({
    status, count: periodAppointments.filter((item) => item.status === status).length,
  }));
  const pipeline = (['open', 'contacted', 'recovered', 'lost'] as RecoveryOpportunityStatus[]).map((status) => {
    const items = periodOpportunities.filter((item) => item.status === status);
    return { status, count: items.length, value: items.reduce((sum, item) => sum + (status === 'recovered' ? item.recoveredValueCents : item.estimatedValueCents), 0) };
  });
  const buckets = generateDailyBuckets(range, bounds.start, periodAppointments, data.opportunities);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-200 md:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><p className="text-sm font-medium text-blue-200">Recovery analytics</p><h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Business performance at a glance</h2><p className="mt-3 max-w-2xl text-slate-300">Track appointment outcomes, revenue exposure, and recovery performance using your live workspace data.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <form><label htmlFor="range" className="sr-only">Analytics date range</label><select id="range" name="range" defaultValue={range} onChange={undefined} className="rounded-full border border-slate-600 bg-slate-900 px-5 py-3 text-sm font-semibold text-white" aria-label="Analytics date range">
              <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
            </select><button type="submit" className="ml-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500">Apply</button></form>
            <Link href="/dashboard/recovery" className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950">Open pipeline</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => <article key={kpi.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">{kpi.label}</p><p className="mt-3 text-3xl font-bold tabular-nums">{kpi.display(current[kpi.key])}</p><p className="mt-2 text-sm font-medium text-blue-600">{comparisonText(current[kpi.key], prior[kpi.key], range, { percentagePoints: kpi.points })}</p></article>)}
      </section>

      {periodAppointments.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><h3 className="font-semibold">No appointments in this period</h3><p className="mt-2 text-sm text-slate-500">Choose another date range or add appointments to begin tracking trends.</p></div> : (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-6"><h3 className="text-lg font-semibold">Daily performance trend</h3><p className="mt-1 text-sm text-slate-500">Daily activity for the selected {range}-day period.</p></div><TrendChart buckets={buckets} /></section>
      )}

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-semibold">Appointment status breakdown</h3><p className="mt-1 text-sm text-slate-500">Appointments starting in the selected period.</p>
          {periodAppointments.length === 0 ? <p className="mt-8 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">No appointments in this period</p> : <div className="mt-6 space-y-4">{statusBreakdown.map((item) => { const percent = item.count / periodAppointments.length * 100; return <div key={item.status}><div className="mb-2 flex justify-between text-sm"><span className="font-medium">{statusLabels[item.status]}</span><span className="tabular-nums text-slate-500">{item.count} · {Math.round(percent * 10) / 10}%</span></div><div className="h-2.5 rounded-full bg-slate-100"><div className="h-2.5 rounded-full bg-blue-600" style={{ width: `${percent}%` }} /></div></div>; })}</div>}
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-semibold">Recovery pipeline</h3><p className="mt-1 text-sm text-slate-500">Opportunities created in the selected period.</p>
          {periodOpportunities.length === 0 ? <p className="mt-8 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">No recovery data yet</p> : <div className="mt-6 grid gap-3 sm:grid-cols-2">{pipeline.map((stage) => <div key={stage.status} className="rounded-2xl border border-slate-100 bg-slate-50 p-5"><p className="text-sm font-medium text-slate-600">{pipelineLabels[stage.status]}</p><div className="mt-3 flex items-end justify-between gap-3"><strong className="text-2xl tabular-nums">{stage.count}</strong><span className="text-sm font-semibold text-slate-700">{formatCurrency(stage.value)}</span></div></div>)}</div>}
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="text-lg font-semibold">Recent activity</h3><p className="mt-1 text-sm text-slate-500">Latest communication events across this workspace.</p></div></div>
        {data.activity.length === 0 ? <p className="mt-6 rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">No recent activity</p> : <ul className="mt-6 divide-y divide-slate-100">{data.activity.map((event) => <li key={event.id} className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" /><div><p className="text-sm font-semibold">{ACTIVITY_LABELS[event.eventType]}</p><p className="mt-1 text-sm text-slate-500">{[event.customerName, event.appointmentName].filter(Boolean).join(' · ') || 'Workspace event'}</p></div></div><time dateTime={event.occurredAt} className="pl-5 text-xs text-slate-500 sm:pl-0">{formatDateTime(event.occurredAt)}</time></li>)}</ul>}
      </section>
    </div>
  );
}
