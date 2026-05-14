import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { LiveDashboardRefresh } from "@/components/dashboard/live-refresh";
import { ToastProvider } from "@/components/dashboard/toast";
import { requireOnboardedSession } from "@/lib/auth/session";

export const dynamic = 'force-dynamic';

const navigation = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/appointments", label: "Appointments" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/waitlist", label: "Waitlist" },
  { href: "/dashboard/recovery", label: "Recovery" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireOnboardedSession();

  return (
    <ToastProvider>
      <LiveDashboardRefresh businessId={session.business.id} />
      <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white p-6 lg:block">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white">AR</span>
          Appointment Recovery AI
        </Link>
        <nav className="mt-10 space-y-2">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-6 left-6 right-6 rounded-3xl bg-slate-950 p-5 text-white">
          <p className="text-sm text-slate-300">{session.business.name}</p>
          <p className="mt-2 font-semibold">{session.role} · {session.email}</p>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">{session.business.name}</p>
              <h1 className="text-xl font-semibold">Recovery workspace</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/pricing" className="hidden rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold sm:block">Pricing</Link>
              <button className="hidden rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white md:block">Invite team</button>
              <LogoutButton />
            </div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
    </ToastProvider>
  );
}
