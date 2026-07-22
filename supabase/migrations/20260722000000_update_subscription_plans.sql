-- Replace retired Stripe plan values while preserving existing subscriptions.
alter table public.subscriptions
  alter column plan drop default;

alter type public.subscription_plan rename to subscription_plan_legacy;
create type public.subscription_plan as enum ('free', 'professional', 'premium');

alter table public.subscriptions
  alter column plan type public.subscription_plan
  using (
    case plan::text
      when 'starter' then 'professional'
      when 'growth' then 'premium'
      when 'pro' then 'premium'
      else plan::text
    end
  )::public.subscription_plan,
  alter column plan set default 'free';

drop type public.subscription_plan_legacy;
