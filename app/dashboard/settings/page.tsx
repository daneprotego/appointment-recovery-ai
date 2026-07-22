const integrationGroups = [
  {
    name: "Supabase",
    description: "Store businesses, users, owner/admin/staff roles, appointments, customers, messages, waitlist records, and Supabase Auth sessions.",
    variables: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    name: "Twilio",
    description: "Send SMS reminders and receive webhook replies for AI classification.",
    variables: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM_NUMBER", "TWILIO_SMS_ENABLED"],
  },
  {
    name: "OpenAI",
    description: "Classify SMS replies into confirm, cancel, reschedule, and human-help intents.",
    variables: ["OPENAI_API_KEY"],
  },
  {
    name: "Stripe",
    description: "Power Free, Professional, and Premium billing plans.",
    variables: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PROFESSIONAL_PRICE_ID", "STRIPE_PREMIUM_PRICE_ID"],
  },
  {
    name: "Calendar integrations",
    description: "Connect Google Calendar and Microsoft Calendar when scheduling sync is ready.",
    variables: ["GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET", "MICROSOFT_CALENDAR_CLIENT_ID", "MICROSOFT_CALENDAR_CLIENT_SECRET"],
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Settings</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">Integration placeholders</h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          This MVP intentionally uses environment variable placeholders only. Add real secrets in your deployment provider or local <code className="rounded bg-slate-200 px-1.5 py-0.5">.env.local</code>, never in source control.
        </p>
      </div>

      <section className="grid gap-5 xl:grid-cols-2">
        {integrationGroups.map((group) => (
          <article key={group.name} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">{group.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{group.description}</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Not connected</span>
            </div>
            <div className="mt-5 space-y-3">
              {group.variables.map((variable) => (
                <label key={variable} className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{variable}</span>
                  <input readOnly value={`process.env.${variable}`} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-600 outline-none" />
                </label>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
