-- Store Stripe price and display plan details from subscription webhooks.
alter table public.subscriptions
  add column if not exists stripe_price_id text,
  add column if not exists plan_name text;
