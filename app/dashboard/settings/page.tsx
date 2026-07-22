import Link from 'next/link';

import { requireOnboardedSession } from '@/lib/auth/session';
import { createReadOnlySupabaseServerClient } from '@/lib/supabase/server';
import type { Subscription, SubscriptionPlan, SubscriptionStatus } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

const planLabels: Record<SubscriptionPlan, string> = {
  free: 'Free',
  professional: 'Professional',
  premium: 'Premium',
};

const statusLabels: Record<SubscriptionStatus, string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past Due',
  cancelled: 'Canceled',
  unpaid: 'Past Due',
};

function formatRenewalDate(date: string | null) {
  if (!date) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(date));
}

export default async function SettingsPage() {
  const session = await requireOnboardedSession();
  const supabase = await createReadOnlySupabaseServerClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('business_id', session.business.id)
    .maybeSingle<Subscription>();

  const subscription = data ?? null;
  const plan = subscription ? planLabels[subscription.plan] : 'Free';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Settings</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">Subscription</h2>
        <p className="mt-2 max-w-3xl text-slate-600">Review your current plan and billing details.</p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Current Plan</p>
            <h3 className="mt-1 text-2xl font-bold">{subscription ? plan : 'Free Plan'}</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              Upgrade
            </Link>
            <button
              type="button"
              disabled
              title="Customer Portal coming soon."
              className="cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-bold text-slate-400"
            >
              Manage Billing
            </button>
          </div>
        </div>

        <dl className="mt-8 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-slate-500">Status</dt>
            <dd className="mt-1 font-semibold text-slate-950">{subscription ? statusLabels[subscription.status] : 'Active'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Renewal date</dt>
            <dd className="mt-1 font-semibold text-slate-950">{formatRenewalDate(subscription?.current_period_end ?? null)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Stripe Customer ID</dt>
            <dd className="mt-1 break-all font-mono text-sm text-slate-950">{subscription?.stripe_customer_id ?? 'Not available'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Stripe Subscription ID</dt>
            <dd className="mt-1 break-all font-mono text-sm text-slate-950">{subscription?.stripe_subscription_id ?? 'Not available'}</dd>
          </div>
        </dl>

        <p className="mt-6 text-sm text-slate-500">Customer Portal coming soon.</p>
      </section>
    </div>
  );
}
