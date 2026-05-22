import { cache } from 'react';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Appointment, Customer, RecoveryOpportunity, WaitlistEntry } from '@/lib/types/database';
import type { DashboardAppointment, DashboardCustomer, DashboardData, DashboardRecoveryOpportunity, DashboardWaitlistEntry } from '@/lib/dashboard/types';

interface CustomerJoin {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
}

interface AppointmentJoin extends Appointment {
  customers: CustomerJoin | null;
}

interface WaitlistJoin extends WaitlistEntry {
  customers: CustomerJoin | null;
}

interface OpportunityJoin extends RecoveryOpportunity {
  customers: CustomerJoin | null;
  appointments: Pick<Appointment, 'id' | 'service_name' | 'starts_at'> | null;
}

function customerName(customer: CustomerJoin | null) {
  return customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown customer';
}

function mapCustomer(customer: Customer): DashboardCustomer {
  return {
    id: customer.id,
    firstName: customer.first_name,
    lastName: customer.last_name,
    fullName: `${customer.first_name} ${customer.last_name}`,
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    status: customer.status,
    smsOptIn: customer.sms_opt_in,
    emailOptIn: customer.email_opt_in,
    noShowCount: customer.no_show_count,
    lifetimeValueCents: customer.lifetime_value_cents,
    notes: customer.notes ?? '',
    createdAt: customer.created_at,
  };
}

function mapAppointment(appointment: AppointmentJoin): DashboardAppointment {
  return {
    id: appointment.id,
    customerId: appointment.customer_id,
    customerName: customerName(appointment.customers),
    customerPhone: appointment.customers?.phone ?? '',
    serviceName: appointment.service_name,
    startsAt: appointment.starts_at,
    endsAt: appointment.ends_at ?? '',
    status: appointment.status,
    riskLevel: appointment.risk_level,
    valueCents: appointment.value_cents,
    cancellationReason: appointment.cancellation_reason ?? '',
    recoveryNotes: appointment.recovery_notes ?? '',
  };
}

function mapWaitlist(entry: WaitlistJoin): DashboardWaitlistEntry {
  return {
    id: entry.id,
    customerId: entry.customer_id,
    customerName: customerName(entry.customers),
    requestedServiceName: entry.requested_service_name ?? '',
    earliestStartAt: entry.earliest_start_at ?? '',
    latestStartAt: entry.latest_start_at ?? '',
    preferredDays: entry.preferred_days ?? [],
    preferredTimes: entry.preferred_times ?? [],
    status: entry.status,
    notes: entry.notes ?? '',
    matchedAppointmentId: entry.matched_appointment_id ?? '',
  };
}

function mapOpportunity(opportunity: OpportunityJoin): DashboardRecoveryOpportunity {
  const matchedWaitlistCustomers = (() => {
    if (!opportunity.metadata || typeof opportunity.metadata !== 'object' || Array.isArray(opportunity.metadata)) {
      return [];
    }

    const candidates = (opportunity.metadata as Record<string, unknown>).matched_waitlist_customers;
    return Array.isArray(candidates) ? candidates : [];
  })();

  return {
    id: opportunity.id,
    appointmentId: opportunity.appointment_id,
    customerId: opportunity.customer_id,
    customerName: customerName(opportunity.customers),
    customerPhone: opportunity.customers?.phone ?? '',
    serviceName: opportunity.appointments?.service_name ?? 'Unknown service',
    appointmentStartsAt: opportunity.appointments?.starts_at ?? '',
    status: opportunity.status,
    priority: opportunity.priority,
    score: opportunity.score,
    estimatedValueCents: opportunity.estimated_value_cents,
    recoveredValueCents: opportunity.recovered_value_cents,
    reason: opportunity.reason ?? '',
    resolvedAt: opportunity.resolved_at ?? '',
    matchedWaitlistCustomers: matchedWaitlistCustomers as DashboardRecoveryOpportunity['matchedWaitlistCustomers'],
  };
}

export const getDashboardData = cache(async (businessId: string): Promise<DashboardData> => {
  const supabase = getSupabaseAdminClient();

  const [customersResult, appointmentsResult, waitlistResult, opportunitiesResult] = await Promise.all([
    supabase.from('customers').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).returns<Customer[]>(),
    supabase
      .from('appointments')
      .select('*, customers(id, first_name, last_name, phone)')
      .eq('business_id', businessId)
      .order('starts_at', { ascending: true })
      .returns<AppointmentJoin[]>(),
    supabase
      .from('waitlists')
      .select('*, customers(id, first_name, last_name, phone)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .returns<WaitlistJoin[]>(),
    supabase
      .from('recovery_opportunities')
      .select('*, customers(id, first_name, last_name, phone), appointments(id, service_name, starts_at)')
      .eq('business_id', businessId)
      .order('score', { ascending: false })
      .returns<OpportunityJoin[]>(),
  ]);

  for (const result of [customersResult, appointmentsResult, waitlistResult, opportunitiesResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  return {
    customers: (customersResult.data ?? []).map(mapCustomer),
    appointments: (appointmentsResult.data ?? []).map(mapAppointment),
    waitlist: (waitlistResult.data ?? []).map(mapWaitlist),
    opportunities: (opportunitiesResult.data ?? []).map(mapOpportunity),
  };
});
