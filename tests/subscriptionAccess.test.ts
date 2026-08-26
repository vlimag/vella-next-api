import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserIdFromAuthHeader, userHasActivePremium } = vi.hoisted(() => ({
  getUserIdFromAuthHeader: vi.fn(),
  userHasActivePremium: vi.fn(),
}));

vi.mock('../lib/auth', () => ({ getUserIdFromAuthHeader }));
vi.mock('../lib/entitlements', () => ({ userHasActivePremium }));

import { requireActiveSubscription } from '../lib/subscriptionAccess';

const AUTH_ONLY_ROUTES = new Set([
  'attribution/install/link',
  'billing/checkout-session',
  'iap/client-event',
  'iap/validate-receipt',
  'me',
  'me/entitlements',
  'me/subscription-transitions/ack',
  'me/subscription-transitions/claim',
]);

const PUBLIC_CALLBACK_ROUTES = new Set([
  'billing/stripe-webhook',
  'health',
  'webhooks/apple',
  'webhooks/google',
]);

const PUBLIC_ANALYTICS_ROUTES = new Set([
  'analytics/events',
]);

const PUBLIC_ONBOARDING_ROUTES = new Set([
  'onboarding/moment',
]);

const PUBLIC_ATTRIBUTION_ROUTES = new Set([
  'attribution/install',
]);

const OPERATOR_ROUTES = new Set([
  'operator/moderation/reports',
  'operator/moderation/reports/[reportId]',
  'operator/growth/summary',
  'operator/growth/spend',
]);

function handlerCount(source: string) {
  return source.match(/export\s+(?:async function|const)\s+(?:GET|POST|PUT|PATCH|DELETE)\b/g)?.length ?? 0;
}

function collectRouteFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectRouteFiles(entryPath);
    return entry.name === 'route.ts' ? [entryPath] : [];
  });
}

describe('subscription-only access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows an authenticated user with an active paid or trial entitlement', async () => {
    getUserIdFromAuthHeader.mockResolvedValue({ userId: 'subscribed-user' });
    userHasActivePremium.mockResolvedValue(true);

    await expect(requireActiveSubscription()).resolves.toEqual({ userId: 'subscribed-user' });
  });

  it('rejects an authenticated user whose entitlement is expired', async () => {
    getUserIdFromAuthHeader.mockResolvedValue({ userId: 'expired-user' });
    userHasActivePremium.mockResolvedValue(false);

    const result = await requireActiveSubscription();
    expect('response' in result).toBe(true);
    if ('response' in result) {
      expect(result.response.status).toBe(402);
      await expect(result.response.json()).resolves.toEqual({
        error: {
          message: 'An active Vella Premium subscription is required',
          details: { code: 'subscription_required' },
        },
      });
    }
  });

  it('rejects an unauthenticated request before checking entitlements', async () => {
    getUserIdFromAuthHeader.mockResolvedValue({ error: 'Missing bearer token' });

    const result = await requireActiveSubscription();
    expect('response' in result).toBe(true);
    if ('response' in result) {
      expect(result.response.status).toBe(401);
      await expect(result.response.json()).resolves.toEqual({
        error: {
          message: 'Missing bearer token',
          details: { code: 'authentication_required' },
        },
      });
    }
    expect(userHasActivePremium).not.toHaveBeenCalled();
  });

  it('fails closed when entitlement verification is unavailable', async () => {
    const userId = 'subscribed-user';
    const privateError = 'database unavailable for subscribed-user';
    getUserIdFromAuthHeader.mockResolvedValue({ userId });
    userHasActivePremium.mockRejectedValue(new Error(privateError));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await requireActiveSubscription();
    expect('response' in result).toBe(true);
    if ('response' in result) {
      expect(result.response.status).toBe(503);
    }
    expect(log).toHaveBeenCalledWith('[subscription-access]', {
      route: 'subscription_access', stage: 'entitlement_check', code: 'entitlement_unavailable',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(userId);
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateError);
  });

  it('keeps every product route handler behind the central gate unless explicitly exempt', () => {
    const apiRoot = path.resolve(process.cwd(), 'app/api/v1');
    const unguarded = collectRouteFiles(apiRoot)
      .filter((file) => {
        const route = path.relative(apiRoot, path.dirname(file));
        if (
          AUTH_ONLY_ROUTES.has(route) ||
          PUBLIC_CALLBACK_ROUTES.has(route) ||
          PUBLIC_ANALYTICS_ROUTES.has(route) ||
          PUBLIC_ONBOARDING_ROUTES.has(route) ||
          PUBLIC_ATTRIBUTION_ROUTES.has(route) ||
          OPERATOR_ROUTES.has(route)
        ) {
          return false;
        }
        const source = fs.readFileSync(file, 'utf8');
        const guardCount = source.match(/await requireActiveSubscription\(\)/g)?.length ?? 0;
        return handlerCount(source) === 0 || guardCount !== handlerCount(source);
      })
      .map((file) => path.relative(apiRoot, file));

    expect(unguarded).toEqual([]);
  });

  it('keeps the public analytics route behind strict event ingestion', () => {
    const apiRoot = path.resolve(process.cwd(), 'app/api/v1');
    const unsafe = collectRouteFiles(apiRoot)
      .filter((file) => {
        const route = path.relative(apiRoot, path.dirname(file));
        if (!PUBLIC_ANALYTICS_ROUTES.has(route)) return false;
        const source = fs.readFileSync(file, 'utf8');
        const ingestionChecks = source.match(/await ingestGrowthEvents\(req\)/g)?.length ?? 0;
        return handlerCount(source) === 0 || ingestionChecks !== handlerCount(source);
      })
      .map((file) => path.relative(apiRoot, file));

    expect(unsafe).toEqual([]);
  });

  it('keeps anonymous attribution capture behind its strict bounded boundary', () => {
    const apiRoot = path.resolve(process.cwd(), 'app/api/v1');
    const unsafe = collectRouteFiles(apiRoot)
      .filter((file) => {
        const route = path.relative(apiRoot, path.dirname(file));
        if (!PUBLIC_ATTRIBUTION_ROUTES.has(route)) return false;
        const source = fs.readFileSync(file, 'utf8');
        const boundaryChecks = source.match(/return handleInstallAttributionRequest\(request\)/g)?.length ?? 0;
        return handlerCount(source) === 0 || boundaryChecks !== handlerCount(source);
      })
      .map((file) => path.relative(apiRoot, file));

    expect(unsafe).toEqual([]);
  });

  it('keeps purchase recovery, entitlement status, and account deletion authenticated', () => {
    const apiRoot = path.resolve(process.cwd(), 'app/api/v1');
    const improperlyExempted = collectRouteFiles(apiRoot)
      .filter((file) => {
        const route = path.relative(apiRoot, path.dirname(file));
        if (!AUTH_ONLY_ROUTES.has(route)) return false;
        const source = fs.readFileSync(file, 'utf8');
        const authChecks = source.match(/await getUserIdFromAuthHeader\(\)/g)?.length ?? 0;
        return handlerCount(source) === 0 || authChecks !== handlerCount(source);
      })
      .map((file) => path.relative(apiRoot, file));

    expect(improperlyExempted).toEqual([]);
  });

  it('keeps every operator route behind the dedicated operator secret', () => {
    const apiRoot = path.resolve(process.cwd(), 'app/api/v1');
    const unguarded = collectRouteFiles(apiRoot)
      .filter((file) => {
        const route = path.relative(apiRoot, path.dirname(file));
        if (!OPERATOR_ROUTES.has(route)) return false;
        const source = fs.readFileSync(file, 'utf8');
        const operatorChecks = source.match(/requireOperatorAccess\(req\)/g)?.length ?? 0;
        return handlerCount(source) === 0 || operatorChecks !== handlerCount(source);
      })
      .map((file) => path.relative(apiRoot, file));

    expect(unguarded).toEqual([]);
  });
});
