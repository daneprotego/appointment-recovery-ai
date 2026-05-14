import Link from "next/link";

const stats = [
  { label: "Appointments today", value: "42", change: "+8%" },
  { label: "At-risk bookings", value: "11", change: "needs review" },
  { label: "Recovered slots", value: "7", change: "$1,120 saved" },
  { label: "Pending replies", value: "18", change: "AI triage" },
];

const activity = [
  "Classified Maria Lopez as reschedule request",
  "Filled 3:30 PM cleaning from waitlist",
  "Sent 24-hour reminders to tomorrow's customers",
  "Flagged two high-value no-show risks",
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl shadow-slate-200">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-blue-200">Welcome back</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Your recovery engine is ready.</h2>
            <p className="mt-3 max-w-2xl text-slate-300">Connect Supabase, Twilio, OpenAI, Stripe, and calendar providers when you are ready to replace demo data with production workflows.</p>
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
            <h3 className="text-lg font-semibold">Recovery pipeline</h3>
            <Link href="/dashboard/appointments" className="text-sm font-semibold text-blue-600">View appointments</Link>
          </div>
          <div className="mt-6 space-y-4">
            {["Reminder queued", "Reply classified", "Reschedule offered", "Waitlist filled"].map((stage, index) => (
              <div key={stage}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium">{stage}</span>
                  <span className="text-slate-500">{88 - index * 14}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div className="h-3 rounded-full bg-blue-600" style={{ width: `${88 - index * 14}%` }} />
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
