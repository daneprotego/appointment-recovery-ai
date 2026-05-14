import Link from "next/link";

const plans = [
  { name: "Free", price: "$0", description: "Validate no-show workflows with manual tracking.", features: ["25 appointments/month", "Basic customer list", "Recovery dashboard preview"] },
  { name: "Starter", price: "$19", description: "Automate reminders for a small front desk team.", features: ["250 appointments/month", "SMS reminder queue", "AI reply labels", "Email support"] },
  { name: "Growth", price: "$39", description: "Recover more revenue with waitlist workflows.", features: ["1,000 appointments/month", "Waitlist fill logic", "Team dashboard", "Priority support"], highlighted: true },
  { name: "Pro", price: "$79", description: "Scale recovery operations across busy locations.", features: ["Unlimited appointments", "Advanced analytics", "Calendar integrations", "Dedicated onboarding"] },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="font-semibold">Appointment Recovery AI</Link>
        <Link href="/dashboard" className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">Open dashboard</Link>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Pricing</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">Simple pricing for every appointment volume.</h1>
          <p className="mt-5 text-lg text-slate-600">Start free, then upgrade when automated SMS recovery and AI triage are ready for production.</p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-4">
          {plans.map((plan) => (
            <article key={plan.name} className={`rounded-3xl border p-6 shadow-sm ${plan.highlighted ? "border-blue-500 bg-blue-600 text-white shadow-blue-600/20" : "border-slate-200 bg-white"}`}>
              {plan.highlighted && <p className="mb-4 w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">Most popular</p>}
              <h2 className="text-2xl font-bold">{plan.name}</h2>
              <p className={`mt-3 text-sm ${plan.highlighted ? "text-blue-50" : "text-slate-600"}`}>{plan.description}</p>
              <div className="mt-6 flex items-end gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className={plan.highlighted ? "text-blue-100" : "text-slate-500"}>/mo</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span>{plan.highlighted ? "✓" : "•"}</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/dashboard" className={`mt-8 block rounded-full px-5 py-3 text-center text-sm font-semibold ${plan.highlighted ? "bg-white text-blue-700" : "bg-slate-950 text-white"}`}>
                Start with {plan.name}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
