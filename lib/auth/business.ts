import type { User } from '@supabase/supabase-js';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Business, BusinessUser, UserRole } from '@/lib/types/database';

export interface BusinessMembership {
  business: Business;
  user: BusinessUser;
  role: UserRole;
}

function normalizeSlug(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return slug || 'workspace';
}

function uniqueWorkspaceSlug(name: string, stableId: string) {
  return `${normalizeSlug(name)}-${stableId.slice(0, 8)}`;
}

export async function getBusinessMembership(authUserId: string): Promise<BusinessMembership | null> {
  const supabase = getSupabaseAdminClient();
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .eq('is_active', true)
    .single<BusinessUser>();

  if (userError || !user) {
    return null;
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', user.business_id)
    .single<Business>();

  if (businessError || !business) {
    return null;
  }

  return {
    business,
    user,
    role: user.role,
  };
}

export async function createOwnerBusinessForUser({
  user,
  businessName,
  fullName,
}: {
  user: User;
  businessName: string;
  fullName?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const email = user.email;

  if (!email) {
    throw new Error('Cannot create a business owner without an email address.');
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert({
      name: businessName,
      slug: uniqueWorkspaceSlug(businessName, user.id),
      status: 'trialing',
      timezone: 'UTC',
      email,
      country: 'US',
      settings: {},
    })
    .select('*')
    .single<Business>();

  if (businessError || !business) {
    throw new Error(businessError?.message ?? 'Unable to create business.');
  }

  const { data: businessUser, error: userError } = await supabase
    .from('users')
    .insert({
      auth_user_id: user.id,
      business_id: business.id,
      email,
      full_name: fullName ?? user.user_metadata?.full_name ?? null,
      role: 'owner' satisfies UserRole,
      is_active: true,
      last_login_at: new Date().toISOString(),
    })
    .select('*')
    .single<BusinessUser>();

  if (userError || !businessUser) {
    await supabase.from('businesses').delete().eq('id', business.id);
    throw new Error(userError?.message ?? 'Unable to create owner profile.');
  }

  return { business, user: businessUser };
}

export async function updateBusinessOnboarding({
  businessId,
  businessName,
  timezone,
}: {
  businessId: string;
  businessName: string;
  timezone: string;
}) {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from('businesses')
    .update({
      name: businessName,
      timezone,
      status: 'active',
    })
    .eq('id', businessId);

  if (error) {
    throw new Error(error.message);
  }
}
