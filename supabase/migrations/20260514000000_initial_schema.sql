-- Appointment Recovery AI initial Supabase schema
-- Apply with: supabase db push or through your Supabase SQL editor.

create extension if not exists pgcrypto;

create type public.business_status as enum ('active', 'inactive', 'trialing', 'suspended');
create type public.user_role as enum ('owner', 'admin', 'staff');
create type public.customer_status as enum ('active', 'inactive', 'blocked');
create type public.appointment_status as enum ('scheduled', 'confirmed', 'cancelled', 'no_show', 'completed', 'rescheduled');
create type public.appointment_risk_level as enum ('low', 'medium', 'high', 'recovered');
create type public.reminder_channel as enum ('sms', 'email', 'voice');
create type public.reminder_status as enum ('queued', 'processing', 'sent', 'delivered', 'failed', 'cancelled');
create type public.waitlist_status as enum ('open', 'matched', 'notified', 'booked', 'expired', 'cancelled');
create type public.subscription_plan as enum ('free', 'professional', 'premium');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'unpaid');
create type public.communication_direction as enum ('inbound', 'outbound', 'internal');
create type public.communication_event_type as enum ('reminder_scheduled', 'reminder_sent', 'reminder_delivered', 'reply_received', 'reply_classified', 'status_change', 'waitlist_offer', 'recovery_note');
create type public.recovery_opportunity_status as enum ('open', 'contacted', 'recovered', 'lost', 'expired');
create type public.recovery_opportunity_priority as enum ('low', 'medium', 'high', 'urgent');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.business_status not null default 'trialing',
  timezone text not null default 'UTC',
  phone text,
  email text,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  country text not null default 'US',
  twilio_messaging_service_sid text,
  sms_from_number text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'staff',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, email)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  status public.customer_status not null default 'active',
  sms_opt_in boolean not null default false,
  email_opt_in boolean not null default true,
  no_show_count integer not null default 0 check (no_show_count >= 0),
  lifetime_value_cents integer not null default 0 check (lifetime_value_cents >= 0),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  assigned_user_id uuid references public.users(id) on delete set null,
  service_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.appointment_status not null default 'scheduled',
  risk_level public.appointment_risk_level not null default 'low',
  value_cents integer not null default 0 check (value_cents >= 0),
  cancellation_reason text,
  recovery_notes text,
  external_calendar_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel public.reminder_channel not null default 'sms',
  status public.reminder_status not null default 'queued',
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  delivered_at timestamptz,
  provider_message_id text,
  message_template text,
  message_body text,
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  locked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.waitlists (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  requested_service_name text,
  earliest_start_at timestamptz,
  latest_start_at timestamptz,
  preferred_days text[] not null default '{}'::text[],
  preferred_times text[] not null default '{}'::text[],
  status public.waitlist_status not null default 'open',
  matched_appointment_id uuid references public.appointments(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (latest_start_at is null or earliest_start_at is null or latest_start_at >= earliest_start_at)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan public.subscription_plan not null default 'free',
  status public.subscription_status not null default 'trialing',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan_name text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id)
);

create table public.communication_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  reminder_id uuid references public.reminders(id) on delete set null,
  channel text not null,
  direction public.communication_direction not null,
  event_type public.communication_event_type not null,
  body text,
  provider_message_id text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recovery_opportunities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  status public.recovery_opportunity_status not null default 'open',
  priority public.recovery_opportunity_priority not null default 'medium',
  score integer not null default 0 check (score >= 0 and score <= 100),
  estimated_value_cents integer not null default 0 check (estimated_value_cents >= 0),
  recovered_value_cents integer not null default 0 check (recovered_value_cents >= 0),
  reason text,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id, status)
);

create index businesses_slug_idx on public.businesses(slug);
create index users_business_id_idx on public.users(business_id);
create index customers_business_id_idx on public.customers(business_id);
create index customers_phone_idx on public.customers(phone);
create index appointments_business_id_starts_at_idx on public.appointments(business_id, starts_at);
create index appointments_customer_id_idx on public.appointments(customer_id);
create index reminders_business_id_scheduled_for_idx on public.reminders(business_id, scheduled_for);
create index reminders_appointment_id_idx on public.reminders(appointment_id);
create index reminders_due_retry_idx on public.reminders(status, scheduled_for, next_attempt_at);
create index waitlists_business_id_status_idx on public.waitlists(business_id, status);
create index subscriptions_business_id_idx on public.subscriptions(business_id);
create index communication_events_business_customer_idx on public.communication_events(business_id, customer_id, occurred_at desc);
create index communication_events_appointment_idx on public.communication_events(appointment_id, occurred_at desc);
create index recovery_opportunities_business_status_idx on public.recovery_opportunities(business_id, status, priority);
create index recovery_opportunities_appointment_idx on public.recovery_opportunities(appointment_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_businesses_updated_at before update on public.businesses for each row execute function public.set_updated_at();
create trigger set_users_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger set_customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger set_appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create trigger set_reminders_updated_at before update on public.reminders for each row execute function public.set_updated_at();
create trigger set_waitlists_updated_at before update on public.waitlists for each row execute function public.set_updated_at();
create trigger set_subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger set_communication_events_updated_at before update on public.communication_events for each row execute function public.set_updated_at();
create trigger set_recovery_opportunities_updated_at before update on public.recovery_opportunities for each row execute function public.set_updated_at();

alter table public.businesses enable row level security;
alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.reminders enable row level security;
alter table public.waitlists enable row level security;
alter table public.subscriptions enable row level security;
alter table public.communication_events enable row level security;
alter table public.recovery_opportunities enable row level security;

create or replace function public.current_user_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.business_id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.is_active = true
  limit 1;
$$;

comment on function public.current_user_business_id() is 'Resolves the current Supabase auth user to a business_id through public.users.auth_user_id for RLS policies.';

create policy "service role manages businesses" on public.businesses for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "members read own business" on public.businesses for select using (id = public.current_user_business_id());

create policy "service role manages users" on public.users for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "members read own users" on public.users for select using (business_id = public.current_user_business_id());

create policy "service role manages customers" on public.customers for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "members read own customers" on public.customers for select using (business_id = public.current_user_business_id());

create policy "service role manages appointments" on public.appointments for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "members read own appointments" on public.appointments for select using (business_id = public.current_user_business_id());

create policy "service role manages reminders" on public.reminders for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "members read own reminders" on public.reminders for select using (business_id = public.current_user_business_id());

create policy "service role manages waitlists" on public.waitlists for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "members read own waitlists" on public.waitlists for select using (business_id = public.current_user_business_id());

create policy "service role manages subscriptions" on public.subscriptions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "members read own subscriptions" on public.subscriptions for select using (business_id = public.current_user_business_id());

create policy "service role manages communication events" on public.communication_events for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "members read own communication events" on public.communication_events for select using (business_id = public.current_user_business_id());

create policy "service role manages recovery opportunities" on public.recovery_opportunities for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "members read own recovery opportunities" on public.recovery_opportunities for select using (business_id = public.current_user_business_id());
