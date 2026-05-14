import Link from 'next/link';

import { requireOnboardedSession } from '@/lib/auth/session';
import { getDashboardData } from '@/lib/dashboard/data';
import { formatCurrency } from '@/lib/dashboard/format';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireOnboardedSession();
  const data = await getDashboardData(session.business.id);
  const openOpportunities = data.opportunities.filter((opportunity) => opportunity.status === 'open' || opportunity.status === 'contacted');
  const recoveredRevenue = data.opportunities.reduce((total, opportunity) => total + opportunity.recoveredValueCents, 0);
  const waitlistOffers = data.waitlist.filter((entry) => entry.status === 'matched' || entry.status === 'notified').length;
  const highRiskAppointments = data.appointments.filter((appointment) => appointment.riskLevel === 'high').length;
  const stats = [
    { label: 'Open recovery opportunities', value: String(openOpportunities.length), change: `${highRiskAppointments} high-risk appointments` },
    { label: 'Recovered revenue', value: formatCurrency(recoveredRevenue), change: 'From recovered opportunities' },
    { label: 'Customers in workspace', value: String(data.customers.length), change: 'Seeded during onboarding' },
    { label: 'Waitlist offers', value: String(waitlistOffers), change: 'Ready for auto-fill' },
  ];
  const activity = [
    'Server Actions now power dashboard CRUD with optimistic client updates and toast feedback.',
    'Supabase live query subscriptions refresh dashboard lists when records change.',
    'Seeded demo customers, appointments, waitlist entries, and recovery opportunities shorten onboarding.',
    'Stripe gates, OpenAI SMS drafting, and Twilio production sending remain isolated behind environment placeholders.',
  ];
  const workflowStages = [
    { stage: 'Scheduled appointments', percent: Math.min(100, data.appointments.length * 16) },
    { stage: 'Customer profiles', percent: Math.min(100, data.customers.length * 18) },
    { stage: 'Waitlist coverage', percent: Math.min(100, data.waitlist.length * 25) },
    { stage: 'Recovery pipeline', percent: Math.min(100, data.opportunities.length * 28) },
    { stage: 'Recovered slots', percent: Math.min(100, data.opportunities.filter((opportunity) => opportunity.status === 'recovered').length * 40) },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-200 md:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-blue-200">Recovery command center</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Your production dashboard is ready for recovery workflows.</h2>
            <p className="mt-3 max-w-2xl text-slate-300">Manage appointments, customers, waitlists, and recovery opportunities with seeded demo data while production integrations stay behind safe environment variables.</p>
          </div>
          <Link href="/dashboard/recovery" className="rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">Open pipeline</Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => <article key={stat.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">{stat.label}</p><p className="mt-3 text-3xl font-bold">{stat.value}</p><p className="mt-2 text-sm font-medium text-blue-600">{stat.change}</p></article>)}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-lg font-semibold">Recovery analytics pipeline</h3><Link href="/dashboard/appointments" className="text-sm font-semibold text-blue-600">View appointments</Link></div>
          <div className="mt-6 space-y-4">{workflowStages.map((stage) => <div key={stage.stage}><div className="mb-2 flex justify-between text-sm"><span className="font-medium">{stage.stage}</span><span className="text-slate-500">{stage.percent}%</span></div><div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-blue-600" style={{ width: `${stage.percent}%` }} /></div></div>)}</div>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-semibold">Recent automation activity</h3><ul className="mt-6 space-y-4">{activity.map((item) => <li key={item} className="flex gap-3 text-sm text-slate-700"><span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" /><span>{item}</span></li>)}</ul></article>
      </section>
    </div>
  );
}
