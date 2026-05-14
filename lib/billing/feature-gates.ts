import type { Subscription, SubscriptionPlan } from '@/lib/types/database';

export type FeatureKey = 'sms_reminders' | 'waitlist_auto_fill' | 'ai_reply_classification' | 'advanced_analytics';

const featurePlanOrder: Record<FeatureKey, SubscriptionPlan> = {
  sms_reminders: 'starter',
  waitlist_auto_fill: 'growth',
  ai_reply_classification: 'growth',
  advanced_analytics: 'pro',
};

const planRank: Record<SubscriptionPlan, number> = { free: 0, starter: 1, growth: 2, pro: 3 };

export function isFeatureEnabled(subscription: Pick<Subscription, 'plan' | 'status'> | null, feature: FeatureKey): boolean {
  if (!subscription || !['trialing', 'active'].includes(subscription.status)) {
    return false;
  }

  return planRank[subscription.plan] >= planRank[featurePlanOrder[feature]];
}
