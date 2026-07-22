import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { SubscriptionPlan, SubscriptionStatus } from '@/lib/types/database';

export const runtime = 'nodejs';

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable.');
  }

  return new Stripe(secretKey);
}

const stripeStatusToSubscriptionStatus: Partial<Record<Stripe.Subscription.Status, SubscriptionStatus>> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'cancelled',
  unpaid: 'unpaid',
};

function getPlanForPrice(priceId: string | null | undefined): SubscriptionPlan {
  if (priceId === process.env.STRIPE_PROFESSIONAL_PRICE_ID) return 'professional';
  if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) return 'premium';
  return 'free';
}

function getUnixTimestamp(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function toIsoString(timestamp: number | null): string | null {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function getSubscriptionPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price.id ?? null;
}

function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === 'string' ? customer : customer.id;
}

function getCurrentPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  const source = item ?? subscription;

  return {
    currentPeriodStart: toIsoString(getUnixTimestamp((source as { current_period_start?: unknown }).current_period_start)),
    currentPeriodEnd: toIsoString(getUnixTimestamp((source as { current_period_end?: unknown }).current_period_end)),
  };
}

async function findBusinessIdForSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  const metadataBusinessId = subscription.metadata.business_id;

  if (metadataBusinessId) {
    return metadataBusinessId;
  }

  const supabase = getSupabaseAdminClient();
  const customerId = getCustomerId(subscription.customer);

  const { data, error } = await supabase
    .from('subscriptions')
    .select('business_id')
    .or(`stripe_subscription_id.eq.${subscription.id},stripe_customer_id.eq.${customerId ?? ''}`)
    .maybeSingle<{ business_id: string }>();

  if (error) {
    console.error('Stripe webhook failed to resolve subscription business.', { subscriptionId: subscription.id, error: error.message });
    return null;
  }

  return data?.business_id ?? null;
}

async function updateBusinessSubscription(subscription: Stripe.Subscription, businessId?: string | null) {
  const resolvedBusinessId = businessId ?? (await findBusinessIdForSubscription(subscription));

  if (!resolvedBusinessId) {
    console.log('Stripe subscription update skipped: missing business id.', { subscriptionId: subscription.id });
    return { updated: false, reason: 'missing_business_id' };
  }

  const priceId = getSubscriptionPriceId(subscription);
  const plan = getPlanForPrice(priceId);
  const { currentPeriodStart, currentPeriodEnd } = getCurrentPeriod(subscription);
  const supabase = getSupabaseAdminClient();
  const payload = {
    business_id: resolvedBusinessId,
    plan,
    plan_name: plan,
    status: stripeStatusToSubscriptionStatus[subscription.status] ?? 'unpaid',
    stripe_customer_id: getCustomerId(subscription.customer),
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_ends_at: toIsoString(subscription.trial_end),
    metadata: subscription.metadata,
  };

  const { error } = await supabase.from('subscriptions').upsert(payload, { onConflict: 'business_id' });

  if (error) {
    console.error('Stripe subscription update failed.', { subscriptionId: subscription.id, businessId: resolvedBusinessId, error: error.message });
    throw error;
  }

  console.log('Stripe subscription update result.', { subscriptionId: subscription.id, businessId: resolvedBusinessId, plan, status: payload.status, updated: true });
  return { updated: true };
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!subscriptionId) {
    console.log('Stripe checkout session completed without subscription.', { sessionId: session.id });
    return;
  }

  const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
  await updateBusinessSubscription(subscription, session.client_reference_id ?? session.metadata?.business_id ?? null);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');

  if (!webhookSecret || !signature) {
    return NextResponse.json({ error: 'Missing Stripe webhook configuration or signature.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Stripe webhook signature.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.log('Stripe webhook event received.', { type: event.type });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await updateBusinessSubscription(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe webhook handler failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
