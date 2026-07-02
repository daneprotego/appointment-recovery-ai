import Link from "next/link";

const metrics = [
  { label: "Missed revenue flagged", value: "$12.4k" },
  { label: "Replies classified", value: "1,248" },
  { label: "Slots recovered", value: "186" },
];

const features = [
  "Automated SMS reminder queues",
  "AI reply classification for cancel, confirm, or reschedule intent",
  "Waitlist matching for open appointment slots",
  "Simple dashboards for front desk and operators",
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-50 text-slate-950">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">AR</span>
          Appointment Recovery AI
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <Link href="#features" className="hover:text-slate-950">Features</Link>
          <Link href="/pricing" className="hover:text-slate-950">Pricing</Link>
          <Link href="/login" className="hover:text-slate-950">Login</Link>
          <Link href="/signup" className="hover:text-slate-950">Sign up</Link>
          <Link href="/dashboard" className="hover:text-slate-950">Dashboard</Link>
        </nav>
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
      >
        Open dashboard
      </Link>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:py-24">
        <div className="absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b from-blue-100 to-transparent" />
        <div className="flex flex-col justify-center">
          <p className="mb-5 inline-flex w-fit rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm">
            Low-cost SaaS for appointment-based businesses
          </p>
          <h1 className="max-w-4xl text-5xl font-bold tracking-tight text-slate-950 md:text-7xl">
            Recover lost appointment revenue automatically.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Appointment Recovery AI helps clinics, salons, studios, and service teams reduce no-shows with automated reminders, AI message triage, rescheduling prompts, and waitlist fill workflows.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/pricing" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-center text-sm font-bold text-slate-950 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
              View pricing
            </Link>
            <Link href="/signup" className="rounded-full border border-slate-300 bg-white px-6 py-3 text-center text-sm font-semibold text-slate-900 transition hover:border-slate-400">
              Start free
            </Link>
            <Link href="/dashboard" className="rounded-full border border-slate-300 bg-white px-6 py-3 text-center text-sm font-semibold text-slate-900 transition hover:border-slate-400">
              Explore dashboard
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/80 bg-white/80 p-4 shadow-2xl shadow-slate-200 backdrop-blur">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm text-slate-400">Recovery command center</p>
                <h2 className="text-xl font-semibold">Today&apos;s impact</h2>
              </div>
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-sm font-medium text-emerald-300">Live</span>
            </div>
            <div className="grid gap-3 py-5 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl bg-white/10 p-4">
                  <p className="text-2xl font-bold">{metric.value}</p>
                  <p className="mt-1 text-xs text-slate-400">{metric.label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {features.map((feature) => (
                <div key={feature} className="flex items-center gap-3 rounded-2xl bg-white p-3 text-slate-900">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">✓</span>
                  <span className="text-sm font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            ["Prevent", "Schedule proactive reminder sequences before each visit."],
            ["Classify", "Use AI to route customer replies into confirm, cancel, and reschedule queues."],
            ["Recover", "Fill newly opened slots with waitlisted customers before revenue is lost."],
          ].map(([title, description]) => (
            <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="mt-3 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
