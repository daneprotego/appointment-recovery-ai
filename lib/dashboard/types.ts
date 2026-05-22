import type {
  AppointmentRiskLevel,
  AppointmentStatus,
  CustomerStatus,
  RecoveryOpportunityPriority,
  RecoveryOpportunityStatus,
  WaitlistStatus,
} from '@/lib/types/database';

export interface DashboardCustomer {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  status: CustomerStatus;
  smsOptIn: boolean;
  emailOptIn: boolean;
  noShowCount: number;
  lifetimeValueCents: number;
  notes: string;
  createdAt: string;
}

export interface DashboardAppointment {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  riskLevel: AppointmentRiskLevel;
  valueCents: number;
  cancellationReason: string;
  recoveryNotes: string;
}

export interface DashboardWaitlistEntry {
  id: string;
  customerId: string;
  customerName: string;
  requestedServiceName: string;
  earliestStartAt: string;
  latestStartAt: string;
  preferredDays: string[];
  preferredTimes: string[];
  status: WaitlistStatus;
  notes: string;
  matchedAppointmentId: string;
}

export interface DashboardRecoveryOpportunity {
  id: string;
  appointmentId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  appointmentStartsAt: string;
  status: RecoveryOpportunityStatus;
  priority: RecoveryOpportunityPriority;
  score: number;
  estimatedValueCents: number;
  recoveredValueCents: number;
  reason: string;
  resolvedAt: string;
  matchedWaitlistCustomers: Array<{
    entryId: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    requestedService: string;
    startsAt: string;
    urgencyScore: number;
  }>;
}

export interface DashboardData {
  appointments: DashboardAppointment[];
  customers: DashboardCustomer[];
  waitlist: DashboardWaitlistEntry[];
  opportunities: DashboardRecoveryOpportunity[];
}
