import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { getBusinessMembership } from '@/lib/auth/business';
import { hasRole } from '@/lib/auth/roles';
import { requirePublicSupabaseConfig } from '@/lib/supabase/config';
import { createReadOnlySupabaseServerClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/types/database';

export interface ApiAuthContext {
  businessId: string;
  businessUserId: string;
  userId: string;
  email: string;
  role: UserRole;
}

export type ApiAuthResult =
  | { ok: true; context: ApiAuthContext }
  | { ok: false; response: NextResponse };

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return authorization.slice('bearer '.length).trim();
}

async function getUserFromBearerToken(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const { supabaseUrl, supabaseAnonKey } = requirePublicSupabaseConfig();
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

async function getUserFromCookies() {
  const supabase = await createReadOnlySupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function requireApiAuth(request: NextRequest, roles?: readonly UserRole[]): Promise<ApiAuthResult> {
  const authUser = (await getUserFromBearerToken(request)) ?? (await getUserFromCookies());

  if (!authUser?.email) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Sign in with Supabase Auth or provide a valid Bearer access token.',
        },
        { status: 401 },
      ),
    };
  }

  const membership = await getBusinessMembership(authUser.id);

  if (!membership) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Forbidden',
          message: 'No active business membership was found for this authenticated user.',
        },
        { status: 403 },
      ),
    };
  }

  if (roles && !hasRole(roles, membership.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Forbidden',
          message: `The ${membership.role} role cannot perform this action.`,
        },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    context: {
      businessId: membership.business.id,
      businessUserId: membership.user.id,
      userId: authUser.id,
      email: authUser.email,
      role: membership.role,
    },
  };
}
