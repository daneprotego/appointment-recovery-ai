import Link from "next/link";
import { CheckoutButton } from "@/components/checkout-button";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Validate no-show workflows with manual tracking.",
    features: ["25 appointments/month", "Basic customer list", "Recovery dashboard preview"],
    planKey: null,
  },
  {
    name: "Professional",
    price: "$15",
    description: "Automate reminders for a small front desk team.",
    features: ["250 appointments/month", "SMS reminder queue", "AI reply labels", "Email support"],
    highlighted: true,
    planKey: "professional" as const,
  },
  {
    name: "Premium",
    price: "$30",
    description: "Scale recovery operations across busy locations.",
    features: ["Unlimited appointments", "Waitlist fill logic", "Advanced analytics", "Dedicated onboarding"],
    planKey: "premium" as const,
  },
];

const buttonClass =
  "mt-8 block w-full rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-bold !text-slate-950 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:!text-blue-700";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="font-semibold">
          Appointment Recovery AI
        </Link>

        <Link href="/dashboard" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
          Open dashboard
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Pricing</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">Simple pricing for every appointment volume.</h1>
          <p className="mt-5 text-lg text-slate-600">Start free, then upgrade when automated SMS recovery and AI triage are ready for production.</p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.name} className={`rounded-3xl border p-6 shadow-sm ${plan.highlighted ? "border-blue-500 bg-blue-600 text-white shadow-blue-600/20" : "border-slate-200 bg-white"}`}>
              {plan.highlighted && <p className="mb-4 w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">Most popular</p>}

              <h2 className="text-2xl font-bold">{plan.name}</h2>
              <p className={`mt-3 text-sm ${plan.highlighted ? "text-blue-50" : "text-slate-600"}`}>{plan.description}</p>

              <div className="mt-6 flex items-end gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className={plan.highlighted ? "text-blue-100" : "text-slate-500"}>/month</span>
              </div>

              <ul className="mt-6 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span>{plan.highlighted ? "✓" : "•"}</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.planKey ? (
                <CheckoutButton plan={plan.planKey} className={buttonClass}>
                  Start with {plan.name}
                </CheckoutButton>
              ) : (
                <Link href="/signup" className={buttonClass}>
                  Start with Free
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
