import Link from "next/link";

const stats = [
  { label: "Open recovery opportunities", value: "18", change: "+6 scored today" },
  { label: "Recovered revenue", value: "$12.4k", change: "28% above target" },
  { label: "Reminder backlog", value: "34", change: "retry queue healthy" },
  { label: "Waitlist offers", value: "11", change: "auto-fill active" },
];

const activity = [
  "Cancellation flow opened a high-priority recovery opportunity and notified three waitlist customers.",
  "Reminder worker retried two failed SMS deliveries with exponential backoff.",
  "Customer timeline logged inbound reply classification placeholder for future OpenAI processing.",
  "Subscription gate placeholders are ready for Stripe plan checks before advanced automations run.",
];

const workflowStages = [
  { stage: "Scheduled", percent: 94 },
  { stage: "Reminder queued", percent: 88 },
  { stage: "Reply classified", percent: 72 },
  { stage: "Recovery opportunity", percent: 61 },
  { stage: "Waitlist filled", percent: 44 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl shadow-slate-200">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-blue-200">Recovery command center</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Your appointment recovery workflow is operational.</h2>
            <p className="mt-3 max-w-2xl text-slate-300">Supabase-backed status transitions, reminder jobs, retry handling, waitlist auto-fill, communication timelines, and recovery scoring are wired for production secrets when you are ready.</p>
          </div>
          <Link href="/dashboard/settings" className="rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">Configure integrations</Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-bold">{stat.value}</p>
            <p className="mt-2 text-sm font-medium text-blue-600">{stat.change}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recovery analytics pipeline</h3>
            <Link href="/dashboard/appointments" className="text-sm font-semibold text-blue-600">View appointments</Link>
          </div>
          <div className="mt-6 space-y-4">
            {workflowStages.map((stage) => (
              <div key={stage.stage}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium">{stage.stage}</span>
                  <span className="text-slate-500">{stage.percent}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div className="h-3 rounded-full bg-blue-600" style={{ width: `${stage.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Recent automation activity</h3>
          <ul className="mt-6 space-y-4">
            {activity.map((item) => (
              <li key={item} className="flex gap-3 text-sm text-slate-700">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
