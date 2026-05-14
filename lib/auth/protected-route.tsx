import type { ReactNode } from 'react';

import { hasRole } from '@/lib/auth/roles';
import { requireOnboardedSession } from '@/lib/auth/session';
import type { UserRole } from '@/lib/types/database';

export async function ProtectedRoute({
  children,
  roles,
}: Readonly<{
  children: ReactNode;
  roles?: readonly UserRole[];
}>) {
  const session = await requireOnboardedSession();

  if (roles && !hasRole(roles, session.role)) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h2 className="text-lg font-semibold">Access restricted</h2>
        <p className="mt-2 text-sm">Your {session.role} role does not have access to this workspace area.</p>
      </div>
    );
  }

  return children;
}
