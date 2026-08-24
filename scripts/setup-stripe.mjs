// Idempotent Stripe product + price bootstrapper for FaithHarbor.
//
// Usage (Node 20.6+):
//   yarn stripe:setup                 # reads STRIPE_SECRET_KEY from api/.env
// or:
//   STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe.mjs
//
// It creates (or reuses) two products — Premium Individual and Premium Family —
// each with a monthly and annual recurring price, keyed by a stable `lookup_key`
// so re-running never creates duplicates. It then prints the price IDs to paste
// into your .env files. Start in TEST mode (sk_test_...) before going live.

import Stripe from 'stripe';
import { readFileSync } from 'node:fs';

// ---- Edit these to change your catalog / pricing --------------------------
const CURRENCY = 'usd';
const PLANS = [
  {
    product: { slug: 'premium_individual', name: 'FaithHarbor Premium', description: 'Premium journeys, deep study, and audio for one person.' },
    prices: [
      { lookup_key: 'premium_individual_monthly', unit_amount: 499, interval: 'month', envVar: 'STRIPE_PRICE_PREMIUM_INDIVIDUAL_MONTHLY' },
      { lookup_key: 'premium_individual_annual', unit_amount: 3999, interval: 'year', envVar: 'STRIPE_PRICE_PREMIUM_INDIVIDUAL_ANNUAL' },
    ],
  },
  {
    product: { slug: 'premium_family', name: 'FaithHarbor Family', description: 'Premium for the whole family group, shared across seats.' },
    prices: [
      { lookup_key: 'premium_family_monthly', unit_amount: 999, interval: 'month', envVar: 'STRIPE_PRICE_PREMIUM_FAMILY_MONTHLY' },
      { lookup_key: 'premium_family_annual', unit_amount: 8999, interval: 'year', envVar: 'STRIPE_PRICE_PREMIUM_FAMILY_ANNUAL' },
    ],
  },
];
// ---------------------------------------------------------------------------

function resolveSecretKey() {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY;
  // Fallback: parse api/.env directly so the script works without --env-file.
  try {
    const envPath = new URL('../.env', import.meta.url);
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*STRIPE_SECRET_KEY\s*=\s*(.+)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '').trim();
    }
  } catch {
    /* no .env file — fall through */
  }
  return '';
}

const secretKey = resolveSecretKey();
if (!secretKey) {
  console.error('✗ Missing STRIPE_SECRET_KEY. Set it in api/.env or pass it inline.');
  process.exit(1);
}
if (secretKey.startsWith('sk_live_')) {
  console.warn('⚠  Using a LIVE Stripe key. This will create real, chargeable products.');
}

const stripe = new Stripe(secretKey);

async function ensureProduct({ slug, name, description }) {
  const existing = await stripe.products.search({ query: `metadata['slug']:'${slug}'`, limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return stripe.products.create({ name, description, metadata: { slug } });
}

async function ensurePrice(productId, { lookup_key, unit_amount, interval }) {
  const found = await stripe.prices.list({ lookup_keys: [lookup_key], limit: 1 });
  if (found.data[0]) return found.data[0];
  return stripe.prices.create({
    product: productId,
    currency: CURRENCY,
    unit_amount,
    recurring: { interval },
    lookup_key,
    transfer_lookup_key: true,
  });
}

const envOut = [];
console.log('Setting up FaithHarbor Stripe catalog…\n');

for (const plan of PLANS) {
  const product = await ensureProduct(plan.product);
  console.log(`• Product: ${product.name} (${product.id})`);
  for (const price of plan.prices) {
    const created = await ensurePrice(product.id, price);
    const amount = (price.unit_amount / 100).toFixed(2);
    console.log(`    - ${price.lookup_key}: ${created.id}  (${amount} ${CURRENCY}/${price.interval})`);
    envOut.push(`${price.envVar}=${created.id}`);
  }
}

console.log('\n✓ Done. Add these to api/.env:\n');
console.log(envOut.join('\n'));
console.log('\nAlso set EXPO_PUBLIC_STRIPE_PREMIUM_PRICE_ID in mobile/.env to the individual-monthly id above,');
console.log('then configure your webhook (see docs/STRIPE_SETUP.md).');
