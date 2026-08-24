export type VellaSubscriptionPlan = 'monthly' | 'yearly';

export const VELLA_SUBSCRIPTION_PLAN_BY_PRODUCT_ID = new Map<string, VellaSubscriptionPlan>([
  ['vella.premium.monthly', 'monthly'],
  ['vella.premium.yearly', 'yearly'],
]);

export const VELLA_SUBSCRIPTION_PRODUCT_IDS = new Set(
  VELLA_SUBSCRIPTION_PLAN_BY_PRODUCT_ID.keys(),
);

export function isVellaSubscriptionProduct(productId: string): boolean {
  return VELLA_SUBSCRIPTION_PRODUCT_IDS.has(productId);
}

export function vellaSubscriptionPlan(productId: string): VellaSubscriptionPlan | null {
  return VELLA_SUBSCRIPTION_PLAN_BY_PRODUCT_ID.get(productId) ?? null;
}
