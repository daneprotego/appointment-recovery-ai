import { CustomersManager } from '@/components/dashboard/customers-manager';
import { requireOnboardedSession } from '@/lib/auth/session';
import { getDashboardData } from '@/lib/dashboard/data';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const session = await requireOnboardedSession();
  const data = await getDashboardData(session.business.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Customers</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Customer recovery profiles</h2>
          <p className="mt-2 text-slate-600">Manage contact preferences, value, no-show history, and notes used by future AI-generated SMS.</p>
        </div>
      </div>
      <CustomersManager customers={data.customers} />
    </div>
  );
}
