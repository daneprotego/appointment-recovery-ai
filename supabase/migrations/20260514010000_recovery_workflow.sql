-- Real appointment recovery workflow additions.

alter type public.reminder_status add value if not exists 'processing';

do $$
begin
  create type public.communication_direction as enum ('inbound', 'outbound', 'internal');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.communication_event_type as enum (
    'reminder_scheduled',
    'reminder_sent',
    'reminder_delivered',
    'reply_received',
    'reply_classified',
    'status_change',
    'waitlist_offer',
    'recovery_note'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.recovery_opportunity_status as enum ('open', 'contacted', 'recovered', 'lost', 'expired');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.recovery_opportunity_priority as enum ('low', 'medium', 'high', 'urgent');
exception
  when duplicate_object then null;
end $$;

alter table public.reminders
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists max_attempts integer not null default 3 check (max_attempts > 0),
  add column if not exists next_attempt_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists locked_at timestamptz;

create table if not exists public.communication_events (
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

create table if not exists public.recovery_opportunities (
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

create index if not exists reminders_due_retry_idx on public.reminders(status, scheduled_for, next_attempt_at);
create index if not exists communication_events_business_customer_idx on public.communication_events(business_id, customer_id, occurred_at desc);
create index if not exists communication_events_appointment_idx on public.communication_events(appointment_id, occurred_at desc);
create index if not exists recovery_opportunities_business_status_idx on public.recovery_opportunities(business_id, status, priority);
create index if not exists recovery_opportunities_appointment_idx on public.recovery_opportunities(appointment_id);

drop trigger if exists set_communication_events_updated_at on public.communication_events;
create trigger set_communication_events_updated_at before update on public.communication_events for each row execute function public.set_updated_at();

drop trigger if exists set_recovery_opportunities_updated_at on public.recovery_opportunities;
create trigger set_recovery_opportunities_updated_at before update on public.recovery_opportunities for each row execute function public.set_updated_at();

alter table public.communication_events enable row level security;
alter table public.recovery_opportunities enable row level security;

create policy "service role manages communication events" on public.communication_events for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "members read own communication events" on public.communication_events for select using (business_id = public.current_user_business_id());

create policy "service role manages recovery opportunities" on public.recovery_opportunities for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "members read own recovery opportunities" on public.recovery_opportunities for select using (business_id = public.current_user_business_id());
