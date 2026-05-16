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

export async function seedDemoBusinessData(businessId: string) {
  const supabase = getSupabaseAdminClient();
  const { count, error: countError } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId);

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const now = new Date();
  const daysFromNow = (days: number, hour: number, minute = 0) => {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() + days);
    date.setUTCHours(hour, minute, 0, 0);
    return date.toISOString();
  };

  const { data: customers, error: customerError } = await supabase
    .from('customers')
    .insert([
      { business_id: businessId, first_name: 'Avery', last_name: 'Chen', email: 'avery@example.com', phone: '+15550148821', status: 'active', sms_opt_in: true, email_opt_in: true, no_show_count: 0, lifetime_value_cents: 124000, notes: 'Prefers morning appointments.', metadata: {} },
      { business_id: businessId, first_name: 'Marcus', last_name: 'Reed', email: 'marcus@example.com', phone: '+15550184430', status: 'active', sms_opt_in: true, email_opt_in: false, no_show_count: 0, lifetime_value_cents: 88000, notes: 'Usually replies quickly by SMS.', metadata: {} },
      { business_id: businessId, first_name: 'Priya', last_name: 'Shah', email: 'priya@example.com', phone: '+15550119284', status: 'active', sms_opt_in: true, email_opt_in: true, no_show_count: 0, lifetime_value_cents: 245000, notes: 'High-value recovery profile.', metadata: {} },
      { business_id: businessId, first_name: 'Jordan', last_name: 'Kim', email: 'jordan@example.com', phone: '+15550173329', status: 'active', sms_opt_in: true, email_opt_in: true, no_show_count: 0, lifetime_value_cents: 76000, notes: 'Flexible on Thursdays.', metadata: {} },
      { business_id: businessId, first_name: 'Sofia', last_name: 'Garcia', email: 'sofia@example.com', phone: '+15550131099', status: 'active', sms_opt_in: true, email_opt_in: true, no_show_count: 0, lifetime_value_cents: 108000, notes: 'Interested in short-notice openings.', metadata: {} },
    ])
    .select('*');

  if (customerError || !customers) {
    throw new Error(customerError?.message ?? 'Unable to seed demo customers.');
  }

  const byFirstName = new Map(customers.map((customer) => [customer.first_name, customer]));
  const avery = byFirstName.get('Avery');
  const marcus = byFirstName.get('Marcus');
  const priya = byFirstName.get('Priya');
  const jordan = byFirstName.get('Jordan');
  const sofia = byFirstName.get('Sofia');

  if (!avery || !marcus || !priya || !jordan || !sofia) {
    throw new Error('Demo customer seed did not return all expected records.');
  }

  const { data: appointments, error: appointmentError } = await supabase
    .from('appointments')
    .insert([
      { business_id: businessId, customer_id: avery.id, service_name: 'Dental cleaning', starts_at: daysFromNow(1, 14), ends_at: daysFromNow(1, 15), status: 'confirmed', risk_level: 'low', value_cents: 18000, metadata: {} },
      { business_id: businessId, customer_id: marcus.id, service_name: 'Physical therapy', starts_at: daysFromNow(1, 16, 30), ends_at: daysFromNow(1, 17, 15), status: 'scheduled', risk_level: 'medium', value_cents: 14000, metadata: {} },
      { business_id: businessId, customer_id: priya.id, service_name: 'Consultation', starts_at: daysFromNow(2, 18), ends_at: daysFromNow(2, 19), status: 'cancelled', risk_level: 'high', value_cents: 32000, cancellation_reason: 'Client requested a different time.', metadata: {} },
      { business_id: businessId, customer_id: jordan.id, service_name: 'Follow-up visit', starts_at: daysFromNow(2, 21, 30), ends_at: daysFromNow(2, 22), status: 'scheduled', risk_level: 'high', value_cents: 22000, recovery_notes: 'Reminder delivery retry queued.', metadata: {} },
      { business_id: businessId, customer_id: sofia.id, service_name: 'Wellness check', starts_at: daysFromNow(3, 15, 45), ends_at: daysFromNow(3, 16, 30), status: 'rescheduled', risk_level: 'recovered', value_cents: 16000, recovery_notes: 'Filled from waitlist.', metadata: {} },
    ])
    .select('*');

  if (appointmentError || !appointments) {
    throw new Error(appointmentError?.message ?? 'Unable to seed demo appointments.');
  }

  const cancelled = appointments.find((appointment) => appointment.customer_id === priya.id);
  const retry = appointments.find((appointment) => appointment.customer_id === jordan.id);
  const recovered = appointments.find((appointment) => appointment.customer_id === sofia.id);

  await supabase.from('waitlists').insert([
    { business_id: businessId, customer_id: marcus.id, requested_service_name: 'Physical therapy', earliest_start_at: daysFromNow(1, 13), latest_start_at: daysFromNow(5, 22), preferred_days: ['Tuesday', 'Thursday'], preferred_times: ['Morning', 'Afternoon'], status: 'open', notes: 'Can take cancellation slots with 2 hours notice.', metadata: {} },
    { business_id: businessId, customer_id: jordan.id, requested_service_name: 'Follow-up visit', earliest_start_at: daysFromNow(1, 17), latest_start_at: daysFromNow(6, 23), preferred_days: ['Wednesday', 'Friday'], preferred_times: ['Evening'], status: 'notified', matched_appointment_id: cancelled?.id ?? null, notes: 'Offer sent for Priya cancellation.', metadata: {} },
    { business_id: businessId, customer_id: sofia.id, requested_service_name: 'Wellness check', earliest_start_at: daysFromNow(1, 12), latest_start_at: daysFromNow(4, 20), preferred_days: ['Monday', 'Thursday'], preferred_times: ['Afternoon'], status: 'booked', matched_appointment_id: recovered?.id ?? null, notes: 'Booked from automated offer.', metadata: {} },
  ]);

  await supabase.from('recovery_opportunities').insert([
    { business_id: businessId, appointment_id: cancelled?.id, customer_id: priya.id, status: 'open', priority: 'urgent', score: 92, estimated_value_cents: 32000, recovered_value_cents: 0, reason: 'High-value cancellation inside 48 hours.', metadata: {} },
    { business_id: businessId, appointment_id: retry?.id, customer_id: jordan.id, status: 'contacted', priority: 'high', score: 74, estimated_value_cents: 22000, recovered_value_cents: 0, reason: 'Reminder failed twice; retry with alternate copy.', metadata: {} },
    { business_id: businessId, appointment_id: recovered?.id, customer_id: sofia.id, status: 'recovered', priority: 'medium', score: 88, estimated_value_cents: 16000, recovered_value_cents: 16000, resolved_at: new Date().toISOString(), reason: 'Recovered via waitlist offer.', metadata: {} },
  ].filter((opportunity) => opportunity.appointment_id));
}
