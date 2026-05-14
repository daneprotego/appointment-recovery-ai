import { WaitlistManager } from '@/components/dashboard/waitlist-manager';
import { requireOnboardedSession } from '@/lib/auth/session';
import { getDashboardData } from '@/lib/dashboard/data';

export const dynamic = 'force-dynamic';

export default async function WaitlistPage() {
  const session = await requireOnboardedSession();
  const data = await getDashboardData(session.business.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Waitlist</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">Short-notice fill list</h2>
        <p className="mt-2 text-slate-600">Search, filter, match, and manage customers who can fill newly opened appointment slots.</p>
      </div>
      <WaitlistManager entries={data.waitlist} customers={data.customers} appointments={data.appointments} />
    </div>
  );
}
