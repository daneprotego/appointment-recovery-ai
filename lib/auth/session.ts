import { redirect } from 'next/navigation';

import { getBusinessMembership, type BusinessMembership } from '@/lib/auth/business';
import { createReadOnlySupabaseServerClient } from '@/lib/supabase/server';

export interface AuthenticatedSession extends BusinessMembership {
  authUserId: string;
  email: string;
}

export async function getCurrentSession(): Promise<AuthenticatedSession | null> {
  const supabase = await createReadOnlySupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const membership = await getBusinessMembership(user.id);

  if (!membership) {
    return null;
  }

  return {
    ...membership,
    authUserId: user.id,
    email: user.email,
  };
}

export async function requireSession(): Promise<AuthenticatedSession> {
  const session = await getCurrentSession();

  if (!session) {
    redirect('/login');
  }

  return session;
}

export async function requireOnboardedSession(): Promise<AuthenticatedSession> {
  const session = await requireSession();

  if (session.business.status === 'trialing') {
    redirect('/onboarding');
  }

  return session;
}
