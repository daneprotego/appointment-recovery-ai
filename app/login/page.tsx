import Link from 'next/link';

import { loginAction } from '@/lib/auth/actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-950">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white">AR</span>
          Appointment Recovery AI
        </Link>
        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Supabase Auth</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Log in to your workspace</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Use your Supabase email and password account to access the protected recovery dashboard.</p>
        </div>
        {error ? <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}
        <form action={loginAction} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input name="email" type="email" required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input name="password" type="password" required minLength={6} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500" />
          </label>
          <button type="submit" className="w-full rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">Log in</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          New to Appointment Recovery AI? <Link href="/signup" className="font-semibold text-blue-600">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
