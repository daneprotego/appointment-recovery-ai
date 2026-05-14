export const dynamic = 'force-dynamic';

import { completeOnboardingAction } from '@/lib/auth/actions';
import { requireSession } from '@/lib/auth/session';

export default async function OnboardingPage() {
  const session = await requireSession();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-950">
      <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Onboarding</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Finish setting up {session.business.name}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Confirm your business details before entering the protected dashboard. Your account is linked as the {session.role} for this workspace.
        </p>
        <form action={completeOnboardingAction} className="mt-8 grid gap-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Business name</span>
            <input name="businessName" defaultValue={session.business.name} required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Timezone</span>
            <select name="timezone" defaultValue={session.business.timezone} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500">
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
            </select>
          </label>
          <div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold">Business ownership relationship</p>
            <p className="mt-1">Supabase auth user {session.email} is connected to business ID {session.business.id} through the users table.</p>
          </div>
          <button type="submit" className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">Enter dashboard</button>
        </form>
      </section>
    </main>
  );
}
