export const dynamic = 'force-dynamic';

import { logoutAction } from '@/lib/auth/actions';

export default function LogoutPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-950">
      <form action={logoutAction} className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200">
        <h1 className="text-2xl font-bold tracking-tight">Log out</h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">End your Supabase session on this device.</p>
        <button type="submit" className="mt-6 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Log out now</button>
      </form>
    </main>
  );
}
