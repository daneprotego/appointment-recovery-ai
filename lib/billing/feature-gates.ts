import type { Subscription, SubscriptionPlan } from '@/lib/types/database';

export type FeatureKey = 'sms_reminders' | 'waitlist_auto_fill' | 'ai_reply_classification' | 'advanced_analytics';

const featurePlanOrder: Record<FeatureKey, SubscriptionPlan> = {
  sms_reminders: 'professional',
  waitlist_auto_fill: 'premium',
  ai_reply_classification: 'premium',
  advanced_analytics: 'premium',
};

const planRank: Record<SubscriptionPlan, number> = { free: 0, professional: 1, premium: 2 };

export function isFeatureEnabled(subscription: Pick<Subscription, 'plan' | 'status'> | null, feature: FeatureKey): boolean {
  if (!subscription || !['trialing', 'active'].includes(subscription.status)) {
    return false;
  }

  return planRank[subscription.plan] >= planRank[featurePlanOrder[feature]];
}
