import { RecoveryManager } from '@/components/dashboard/recovery-manager';
import { requireOnboardedSession } from '@/lib/auth/session';
import { getDashboardData } from '@/lib/dashboard/data';

export const dynamic = 'force-dynamic';

export default async function RecoveryPage() {
  const session = await requireOnboardedSession();
  const data = await getDashboardData(session.business.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Recovery opportunities</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">Revenue recovery pipeline</h2>
        <p className="mt-2 text-slate-600">Prioritize cancellations, no-shows, and failed reminders before Stripe-gated AI and Twilio automations run.</p>
      </div>
      <RecoveryManager opportunities={data.opportunities} appointments={data.appointments} />
    </div>
  );
}
