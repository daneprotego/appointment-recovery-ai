import { AppointmentsManager } from '@/components/dashboard/appointments-manager';
import { getDashboardData } from '@/lib/dashboard/data';
import { requireOnboardedSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function AppointmentsPage() {
  const session = await requireOnboardedSession();
  const data = await getDashboardData(session.business.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Appointments</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Appointment recovery queue</h2>
          <p className="mt-2 text-slate-600">Create, edit, reschedule, and delete appointments with live recovery context.</p>
        </div>
      </div>
      <AppointmentsManager appointments={data.appointments} customers={data.customers} />
    </div>
  );
}
