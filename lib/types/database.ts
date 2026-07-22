export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type BusinessStatus = 'active' | 'inactive' | 'trialing' | 'suspended';
export type UserRole = 'owner' | 'admin' | 'staff';
export type CustomerStatus = 'active' | 'inactive' | 'blocked';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'no_show' | 'completed' | 'rescheduled';
export type AppointmentRiskLevel = 'low' | 'medium' | 'high' | 'recovered';
export type ReminderChannel = 'sms' | 'email' | 'voice';
export type ReminderStatus = 'queued' | 'processing' | 'sent' | 'delivered' | 'failed' | 'cancelled';
export type WaitlistStatus = 'open' | 'matched' | 'notified' | 'booked' | 'expired' | 'cancelled';
export type SubscriptionPlan = 'free' | 'professional' | 'premium';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'unpaid';
export type CommunicationDirection = 'inbound' | 'outbound' | 'internal';
export type CommunicationEventType = 'reminder_scheduled' | 'reminder_sent' | 'reminder_delivered' | 'reply_received' | 'reply_classified' | 'status_change' | 'waitlist_offer' | 'recovery_note';
export type RecoveryOpportunityStatus = 'open' | 'contacted' | 'recovered' | 'lost' | 'expired';
export type RecoveryOpportunityPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TimestampedRecord {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Business extends TimestampedRecord {
  name: string;
  slug: string;
  status: BusinessStatus;
  timezone: string;
  phone: string | null;
  email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string;
  twilio_messaging_service_sid: string | null;
  sms_from_number: string | null;
  settings: Json;
}

export interface BusinessUser extends TimestampedRecord {
  auth_user_id: string | null;
  business_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
}

export interface Customer extends TimestampedRecord {
  business_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: CustomerStatus;
  sms_opt_in: boolean;
  email_opt_in: boolean;
  no_show_count: number;
  lifetime_value_cents: number;
  notes: string | null;
  metadata: Json;
}

export interface Appointment extends TimestampedRecord {
  business_id: string;
  customer_id: string;
  assigned_user_id: string | null;
  service_name: string;
  starts_at: string;
  ends_at: string | null;
  status: AppointmentStatus;
  risk_level: AppointmentRiskLevel;
  value_cents: number;
  cancellation_reason: string | null;
  recovery_notes: string | null;
  external_calendar_event_id: string | null;
  metadata: Json;
}

export interface Reminder extends TimestampedRecord {
  business_id: string;
  appointment_id: string;
  customer_id: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  scheduled_for: string;
  sent_at: string | null;
  delivered_at: string | null;
  provider_message_id: string | null;
  message_template: string | null;
  message_body: string | null;
  error_message: string | null;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  locked_at: string | null;
  metadata: Json;
}

export interface WaitlistEntry extends TimestampedRecord {
  business_id: string;
  customer_id: string;
  requested_service_name: string | null;
  earliest_start_at: string | null;
  latest_start_at: string | null;
  preferred_days: string[];
  preferred_times: string[];
  status: WaitlistStatus;
  matched_appointment_id: string | null;
  notes: string | null;
  metadata: Json;
}


export interface CommunicationEvent extends TimestampedRecord {
  business_id: string;
  customer_id: string;
  appointment_id: string | null;
  reminder_id: string | null;
  channel: ReminderChannel | 'system';
  direction: CommunicationDirection;
  event_type: CommunicationEventType;
  body: string | null;
  provider_message_id: string | null;
  occurred_at: string;
  metadata: Json;
}

export interface RecoveryOpportunity extends TimestampedRecord {
  business_id: string;
  appointment_id: string;
  customer_id: string;
  status: RecoveryOpportunityStatus;
  priority: RecoveryOpportunityPriority;
  score: number;
  estimated_value_cents: number;
  recovered_value_cents: number;
  reason: string | null;
  resolved_at: string | null;
  metadata: Json;
}

export interface Subscription extends TimestampedRecord {
  business_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan_name: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  metadata: Json;
}

export interface DatabaseTables {
  businesses: Business;
  users: BusinessUser;
  customers: Customer;
  appointments: Appointment;
  reminders: Reminder;
  waitlists: WaitlistEntry;
  communication_events: CommunicationEvent;
  recovery_opportunities: RecoveryOpportunity;
  subscriptions: Subscription;
}

export type TableName = keyof DatabaseTables;

export type CreateBusinessInput = Omit<Business, 'id' | 'created_at' | 'updated_at'>;
export type UpdateBusinessInput = Partial<CreateBusinessInput>;
export type CreateUserInput = Omit<BusinessUser, 'id' | 'created_at' | 'updated_at'>;
export type UpdateUserInput = Partial<CreateUserInput>;
export type CreateCustomerInput = Omit<Customer, 'id' | 'created_at' | 'updated_at'>;
export type UpdateCustomerInput = Partial<CreateCustomerInput>;
export type CreateAppointmentInput = Omit<Appointment, 'id' | 'created_at' | 'updated_at'>;
export type UpdateAppointmentInput = Partial<CreateAppointmentInput>;
export type CreateReminderInput = Omit<Reminder, 'id' | 'created_at' | 'updated_at'>;
export type UpdateReminderInput = Partial<CreateReminderInput>;
export type CreateWaitlistEntryInput = Omit<WaitlistEntry, 'id' | 'created_at' | 'updated_at'>;
export type UpdateWaitlistEntryInput = Partial<CreateWaitlistEntryInput>;
export type CreateCommunicationEventInput = Omit<CommunicationEvent, 'id' | 'created_at' | 'updated_at'>;
export type UpdateCommunicationEventInput = Partial<CreateCommunicationEventInput>;
export type CreateRecoveryOpportunityInput = Omit<RecoveryOpportunity, 'id' | 'created_at' | 'updated_at'>;
export type UpdateRecoveryOpportunityInput = Partial<CreateRecoveryOpportunityInput>;
export type CreateSubscriptionInput = Omit<Subscription, 'id' | 'created_at' | 'updated_at'>;
export type UpdateSubscriptionInput = Partial<CreateSubscriptionInput>;
