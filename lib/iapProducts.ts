export const VELLA_SUBSCRIPTION_PRODUCT_IDS = new Set([
  'vella.premium.monthly',
  'vella.premium.yearly',
]);

export function isVellaSubscriptionProduct(productId: string): boolean {
  return VELLA_SUBSCRIPTION_PRODUCT_IDS.has(productId);
}
