import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APPLE_ATTRIBUTION_ENDPOINT,
  MAX_ATTRIBUTION_REQUEST_BYTES,
  exchangeAppleAttribution,
  handleInstallAttributionRequest,
  handleLinkAttributionRequest,
  parseAppleAttributionPayload,
} from '@/lib/acquisitionAttribution';

const INSTALL_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'QWxwaGFCZXRhMTIzNDU2Nzg5MA==';
const DOTTED_OPAQUE_TOKEN = 'eyJhbGciOiJub25lIn0.opaque_payload-_.signature';
const LEASE_ID = '33333333-3333-4333-8333-333333333333';

function jsonRequest(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

type RpcResult = { data?: unknown; error?: { message?: string; code?: string } | null };

function serviceClient(options: {
  rpc?: (name: string, parameters: Record<string, unknown>) => Promise<RpcResult>;
  profile?: unknown;
  profileError?: { message: string } | null;
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.profile === undefined ? { id: USER_ID } : options.profile,
    error: options.profileError ?? null,
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn(options.rpc ?? (async (name: string) => ({
    data: name === 'preflight_growth_install_attribution'
      ? { lease_id: LEASE_ID, already_resolved: false }
      : { accepted: true },
    error: null,
  })));
  return { client: { rpc, from }, rpc, from, select, eq, maybeSingle };
}

function appleResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const attributedAppleBody = {
  attribution: true,
  orgId: 40669820,
  campaignId: 542370539,
  conversionType: 'Download',
  claimType: 'Click',
  adGroupId: 542317095,
  countryOrRegion: 'BR',
  keywordId: 87675432,
  adId: 542317136,
  supplyPlacement: 'APPSTORE_SEARCH_RESULTS',
};

describe('Apple Ads attribution exchange', () => {
  it('maps Apple adId to ad_id and keeps placement as a constrained string', () => {
    expect(parseAppleAttributionPayload(JSON.stringify(attributedAppleBody))).toEqual({
      kind: 'attributed',
      attribution: {
        provider: 'apple_ads',
        org_id: 40669820,
        campaign_id: 542370539,
        ad_group_id: 542317095,
        keyword_id: 87675432,
        ad_id: 542317136,
        supply_placement: 'APPSTORE_SEARCH_RESULTS',
        conversion_type: 'Download',
      },
    });
    expect(JSON.stringify(parseAppleAttributionPayload(JSON.stringify(attributedAppleBody))))
      .not.toContain('placement_id');
  });

  it('accepts the documented non-attributed response without inventing organic truth', () => {
    expect(parseAppleAttributionPayload('{"attribution":false}')).toEqual({
      kind: 'unattributed',
    });
  });

  it.each([
    ['unsafe placement', { ...attributedAppleBody, supplyPlacement: 'PRIVATE_PLACEMENT' }],
    ['non-numeric ad ID', { ...attributedAppleBody, adId: '542317136' }],
    ['unsafe integer', { ...attributedAppleBody, campaignId: Number.MAX_SAFE_INTEGER + 1 }],
    ['missing campaign ID', { ...attributedAppleBody, campaignId: undefined }],
    ['attribution false with campaign data', { attribution: false, campaignId: 1 }],
  ])('rejects %s in an upstream payload', (_label, body) => {
    expect(parseAppleAttributionPayload(JSON.stringify(body))).toEqual({ kind: 'invalid' });
  });

  it('tolerates additive Apple fields while projecting only the closed known core', () => {
    const parsed = parseAppleAttributionPayload(JSON.stringify({
      ...attributedAppleBody,
      futureAppleField: { nested: 'must not escape' },
    }));

    expect(parsed).toEqual(expect.objectContaining({ kind: 'attributed' }));
    expect(JSON.stringify(parsed)).not.toContain('futureAppleField');
    expect(JSON.stringify(parsed)).not.toContain('must not escape');
  });

  it.each(['not json', '', '{"attribution":true}'])('rejects malformed Apple payload %j', (body) => {
    expect(parseAppleAttributionPayload(body)).toEqual({ kind: 'invalid' });
  });

  it('posts the transient token as text/plain to the exact Apple endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(appleResponse({ attribution: false }));

    await expect(exchangeAppleAttribution(TOKEN, { fetchImpl })).resolves.toEqual({
      kind: 'unattributed',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      APPLE_ATTRIBUTION_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        body: TOKEN,
        headers: { 'Content-Type': 'text/plain' },
        cache: 'no-store',
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('accepts a dotted opaque AdServices token and forwards it byte-for-byte', async () => {
    const { client } = serviceClient();
    const fetchImpl = vi.fn().mockResolvedValue(appleResponse({ attribution: false }));

    const response = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', {
        installation_id: INSTALL_ID,
        platform: 'ios',
        token: DOTTED_OPAQUE_TOKEN,
      }),
      { createServiceClient: () => client as never, fetchImpl, appleAdsOrgId: 40669820 },
    );

    expect(response.status).toBe(202);
    expect(fetchImpl).toHaveBeenCalledWith(
      APPLE_ATTRIBUTION_ENDPOINT,
      expect.objectContaining({ body: DOTTED_OPAQUE_TOKEN }),
    );
  });

  it('uses Apple\'s bounded 5-second retry guidance for an early 404', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(appleResponse('', 404))
      .mockResolvedValueOnce(appleResponse('', 404))
      .mockResolvedValueOnce(appleResponse({ attribution: false }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(exchangeAppleAttribution(TOKEN, { fetchImpl, sleep })).resolves.toEqual({
      kind: 'unattributed',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[5_000], [5_000]]);
  });

  it('returns an explicit retryable result after the third 404 and never loops further', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(appleResponse('', 404));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(exchangeAppleAttribution(TOKEN, { fetchImpl, sleep })).resolves.toEqual({
      kind: 'retryable',
      reason: 'not_ready',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it.each([
    [400, { kind: 'invalid_token' }],
    [500, { kind: 'retryable', reason: 'upstream_unavailable' }],
    [503, { kind: 'retryable', reason: 'upstream_unavailable' }],
  ])('maps upstream HTTP %s without returning the upstream body', async (status, expected) => {
    const secretBody = `private-upstream-body-${status}`;
    const fetchImpl = vi.fn().mockResolvedValue(appleResponse(secretBody, status));

    const result = await exchangeAppleAttribution(TOKEN, { fetchImpl });

    expect(result).toEqual(expected);
    expect(JSON.stringify(result)).not.toContain(secretBody);
  });

  it('treats timeouts, fetch failures, oversized responses, and invalid JSON as coarse failures', async () => {
    const networkFailure = vi.fn().mockRejectedValue(new Error(`network ${TOKEN}`));
    await expect(exchangeAppleAttribution(TOKEN, { fetchImpl: networkFailure })).resolves.toEqual({
      kind: 'retryable',
      reason: 'upstream_unavailable',
    });

    const oversized = vi.fn().mockResolvedValue(appleResponse('x'.repeat(8_193)));
    await expect(exchangeAppleAttribution(TOKEN, { fetchImpl: oversized })).resolves.toEqual({
      kind: 'invalid_response',
    });

    const invalidJson = vi.fn().mockResolvedValue(appleResponse('not-json'));
    await expect(exchangeAppleAttribution(TOKEN, { fetchImpl: invalidJson })).resolves.toEqual({
      kind: 'invalid_response',
    });
  });

  it('reads Apple responses through the bounded stream instead of Response.text()', async () => {
    const response = appleResponse({ attribution: false });
    const text = vi.spyOn(response, 'text').mockRejectedValue(new Error('unbounded read used'));
    const fetchImpl = vi.fn().mockResolvedValue(response);

    await expect(exchangeAppleAttribution(TOKEN, { fetchImpl })).resolves.toEqual({
      kind: 'unattributed',
    });
    expect(text).not.toHaveBeenCalled();
  });
});

describe('install attribution request boundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts only the four Android coarse codes and records them after atomic preflight', async () => {
    const { client, rpc } = serviceClient();
    const request = jsonRequest('https://vella.one/api/v1/attribution/install', {
      installation_id: INSTALL_ID,
      platform: 'android',
      attribution: {
        source: 'google',
        medium: 'cpc',
        campaign: 'vella_br_android_202608',
        creative_code: 'prayer_words_01',
      },
    });

    const response = await handleInstallAttributionRequest(request, {
      createServiceClient: () => client as never,
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ data: { status: 'accepted' } });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'preflight_growth_install_attribution',
      'record_growth_install_attribution',
    ]);
    expect(rpc).toHaveBeenNthCalledWith(1, 'preflight_growth_install_attribution', {
      p_installation_id: INSTALL_ID,
      p_platform: 'android',
      p_has_attribution: true,
    });
    expect(rpc).toHaveBeenLastCalledWith('record_growth_install_attribution', {
      p_installation_id: INSTALL_ID,
      p_platform: 'android',
      p_provider: 'play_install_referrer',
      p_source: 'google',
      p_medium: 'cpc',
      p_campaign: 'vella_br_android_202608',
      p_creative_code: 'prayer_words_01',
      p_org_id: null,
      p_campaign_id: null,
      p_ad_group_id: null,
      p_keyword_id: null,
      p_ad_id: null,
      p_supply_placement: null,
      p_conversion_type: null,
      p_resolution_status: 'resolved',
      p_attributed: true,
    });
  });

  it('accepts an empty Android allowlist as unattributed rather than organic', async () => {
    const { client, rpc } = serviceClient();
    const response = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', {
        installation_id: INSTALL_ID,
        platform: 'android',
        attribution: {},
      }),
      { createServiceClient: () => client as never },
    );

    expect(response.status).toBe(202);
    expect(rpc).toHaveBeenLastCalledWith(
      'record_growth_install_attribution',
      expect.objectContaining({ p_provider: null, p_attributed: false }),
    );
  });

  it.each([
    ['an extra envelope key', { installation_id: INSTALL_ID, platform: 'android', attribution: {}, extra: true }],
    ['gclid', { installation_id: INSTALL_ID, platform: 'android', attribution: { gclid: 'secret' } }],
    ['a raw referrer', { installation_id: INSTALL_ID, platform: 'android', attribution: { referrer: 'utm_source=google' } }],
    ['an uppercase code', { installation_id: INSTALL_ID, platform: 'android', attribution: { source: 'Google' } }],
    ['a URL code', { installation_id: INSTALL_ID, platform: 'android', attribution: { source: 'https://google.com' } }],
    ['a malformed UUID', { installation_id: 'device-1', platform: 'android', attribution: {} }],
    ['an Android token', { installation_id: INSTALL_ID, platform: 'android', attribution: {}, token: TOKEN }],
    ['an iOS attribution object', { installation_id: INSTALL_ID, platform: 'ios', attribution: {} }],
    ['an iOS extra key', { installation_id: INSTALL_ID, platform: 'ios', token: TOKEN, user_id: USER_ID }],
  ])('rejects %s before database access', async (_label, body) => {
    const { client, rpc } = serviceClient();
    const response = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', body),
      { createServiceClient: () => client as never },
    );

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('enforces the 8 KiB limit from both declared and actual UTF-8 bytes', async () => {
    const { client, rpc } = serviceClient();
    const declared = await handleInstallAttributionRequest(
      jsonRequest(
        'https://vella.one/api/v1/attribution/install',
        { installation_id: INSTALL_ID, platform: 'android', attribution: {} },
        { 'Content-Length': String(MAX_ATTRIBUTION_REQUEST_BYTES + 1) },
      ),
      { createServiceClient: () => client as never },
    );
    expect(declared.status).toBe(413);

    const actual = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', 'x'.repeat(8_193)),
      { createServiceClient: () => client as never },
    );
    expect(actual.status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reads request bodies through a bounded stream instead of Request.text()', async () => {
    const { client } = serviceClient();
    const request = jsonRequest('https://vella.one/api/v1/attribution/install', {
      installation_id: INSTALL_ID,
      platform: 'android',
      attribution: {},
    });
    const text = vi.spyOn(request, 'text').mockRejectedValue(new Error('unbounded read used'));

    const response = await handleInstallAttributionRequest(request, {
      createServiceClient: () => client as never,
    });

    expect(response.status).toBe(202);
    expect(text).not.toHaveBeenCalled();
  });

  it('requires the exact JSON media type', async () => {
    const { client, rpc } = serviceClient();
    const request = new Request('https://vella.one/api/v1/attribution/install', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{}',
    });
    const response = await handleInstallAttributionRequest(request, {
      createServiceClient: () => client as never,
    });

    expect(response.status).toBe(415);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('keeps iOS pending until exchange, resolves a valid Apple result, and discards the token', async () => {
    const { client, rpc } = serviceClient();
    const fetchImpl = vi.fn().mockResolvedValue(appleResponse({
      ...attributedAppleBody,
      clickDate: '2026-08-25T01:02:03Z',
      futureAppleField: 'UPSTREAM_SECRET_SENTINEL',
    }));
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', {
        installation_id: INSTALL_ID,
        platform: 'ios',
        token: TOKEN,
      }),
      { createServiceClient: () => client as never, fetchImpl, appleAdsOrgId: 40669820 },
    );
    const responseText = await response.text();

    expect(response.status).toBe(202);
    expect(responseText).toBe('{"data":{"status":"accepted"}}');
    const finalizerCalls = rpc.mock.calls.filter(
      ([name]) => name === 'finalize_growth_apple_attribution',
    );
    expect(finalizerCalls).toHaveLength(1);
    expect(finalizerCalls[0]?.[1]).toEqual(expect.objectContaining({
      p_lease_id: LEASE_ID,
      p_ad_id: attributedAppleBody.adId,
      p_supply_placement: attributedAppleBody.supplyPlacement,
      p_conversion_type: attributedAppleBody.conversionType,
      p_attributed: true,
    }));
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'preflight_growth_install_attribution',
      'finalize_growth_apple_attribution',
    ]);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('UPSTREAM_SECRET_SENTINEL');
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('2026-08-25T01:02:03Z');
    expect(responseText).not.toContain(TOKEN);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('treats Apple 200 attribution:false as terminal resolved-unattributed truth', async () => {
    const { client, rpc } = serviceClient();
    const fetchImpl = vi.fn().mockResolvedValue(appleResponse({
      attribution: false,
      futureAppleField: 'ignored',
    }));

    const response = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', {
        installation_id: INSTALL_ID,
        platform: 'ios',
        token: TOKEN,
      }),
      { createServiceClient: () => client as never, fetchImpl, appleAdsOrgId: 40669820 },
    );

    expect(response.status).toBe(202);
    expect(rpc).toHaveBeenCalledWith('finalize_growth_apple_attribution', {
      p_installation_id: INSTALL_ID,
      p_lease_id: LEASE_ID,
      p_attributed: false,
      p_org_id: null,
      p_campaign_id: null,
      p_ad_group_id: null,
      p_keyword_id: null,
      p_ad_id: null,
      p_supply_placement: null,
      p_conversion_type: null,
    });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'preflight_growth_install_attribution',
      'finalize_growth_apple_attribution',
    ]);
  });

  it('fails closed before database or Apple access when the Vella Ads org is unconfigured', async () => {
    const previous = process.env.APPLE_ADS_ORG_ID;
    delete process.env.APPLE_ADS_ORG_ID;
    const { client, rpc } = serviceClient();
    const fetchImpl = vi.fn();

    try {
      const response = await handleInstallAttributionRequest(
        jsonRequest('https://vella.one/api/v1/attribution/install', {
          installation_id: INSTALL_ID,
          platform: 'ios',
          token: TOKEN,
        }),
        { createServiceClient: () => client as never, fetchImpl },
      );

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: {
          message: 'Apple attribution is not configured',
          details: { code: 'apple_attribution_not_configured' },
        },
      });
      expect(rpc).not.toHaveBeenCalled();
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.APPLE_ADS_ORG_ID;
      else process.env.APPLE_ADS_ORG_ID = previous;
    }
  });

  it('returns explicit retry guidance after bounded Apple 404s without leaking identifiers', async () => {
    const { client, rpc } = serviceClient();
    const fetchImpl = vi.fn().mockResolvedValue(appleResponse('private apple body', 404));
    const response = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', {
        installation_id: INSTALL_ID,
        platform: 'ios',
        token: TOKEN,
      }),
      {
        createServiceClient: () => client as never,
        fetchImpl,
        sleep: async () => undefined,
        appleAdsOrgId: 40669820,
      },
    );
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(body)).toEqual({
      error: {
        message: 'Apple attribution is not ready yet',
        details: { code: 'apple_attribution_retryable', retry_after_seconds: 5 },
      },
    });
    for (const secret of [INSTALL_ID, TOKEN, 'private apple body']) {
      expect(body).not.toContain(secret);
    }
    expect(rpc.mock.calls.some(([name]) => name === 'record_growth_install_attribution'))
      .toBe(false);
    expect(rpc).toHaveBeenCalledWith('record_growth_attribution_upstream_result', {
      p_installation_id: INSTALL_ID,
      p_lease_id: LEASE_ID,
      p_outcome: 'neutral',
    });
  });

  it('keeps an upstream Apple 5xx pending and records only breaker state', async () => {
    const { client, rpc } = serviceClient();
    const fetchImpl = vi.fn().mockResolvedValue(appleResponse('private outage body', 503));
    const response = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', {
        installation_id: INSTALL_ID,
        platform: 'ios',
        token: TOKEN,
      }),
      { createServiceClient: () => client as never, fetchImpl, appleAdsOrgId: 40669820 },
    );

    expect(response.status).toBe(503);
    expect(rpc.mock.calls.some(([name]) => name === 'record_growth_install_attribution'))
      .toBe(false);
    expect(rpc).toHaveBeenCalledWith('record_growth_attribution_upstream_result', {
      p_installation_id: INSTALL_ID,
      p_lease_id: LEASE_ID,
      p_outcome: 'upstream_failure',
    });
  });

  it('does not source-qualify an Apple token issued for another Ads organization', async () => {
    const { client, rpc } = serviceClient();
    const fetchImpl = vi.fn().mockResolvedValue(appleResponse(attributedAppleBody));
    const response = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', {
        installation_id: INSTALL_ID,
        platform: 'ios',
        token: TOKEN,
      }),
      {
        createServiceClient: () => client as never,
        fetchImpl,
        appleAdsOrgId: 99999999,
      },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: 'Apple attribution organization does not match Vella',
        details: { code: 'apple_attribution_org_mismatch' },
      },
    });
    const attributedWrite = rpc.mock.calls.find(([name, parameters]) => (
      name === 'record_growth_install_attribution' && parameters.p_attributed === true
    ));
    expect(attributedWrite).toBeUndefined();
  });

  it('fails retryably when the database cannot atomically finalize Apple truth and its lease', async () => {
    const { client } = serviceClient({
      rpc: async (name) => {
        if (name === 'preflight_growth_install_attribution') {
          return { data: { lease_id: LEASE_ID, already_resolved: false }, error: null };
        }
        if (name === 'finalize_growth_apple_attribution') {
          return { error: { message: 'database unavailable' } };
        }
        return { data: null, error: null };
      },
    });
    const fetchImpl = vi.fn().mockResolvedValue(appleResponse({ attribution: false }));
    const response = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', {
        installation_id: INSTALL_ID,
        platform: 'ios',
        token: TOKEN,
      }),
      {
        createServiceClient: () => client as never,
        fetchImpl,
        appleAdsOrgId: 40669820,
      },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: 'Could not finalize Apple attribution',
        details: { code: 'attribution_lease_completion_unavailable' },
      },
    });
  });

  it('never splits a terminal Apple write from lease and breaker completion', async () => {
    const { client, rpc } = serviceClient({
      rpc: async (name) => {
        if (name === 'preflight_growth_install_attribution') {
          return { data: { lease_id: LEASE_ID, already_resolved: false }, error: null };
        }
        if (name === 'finalize_growth_apple_attribution') {
          return { error: { message: 'write unavailable' } };
        }
        return { data: null, error: null };
      },
    });
    const response = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', {
        installation_id: INSTALL_ID,
        platform: 'ios',
        token: TOKEN,
      }),
      {
        createServiceClient: () => client as never,
        fetchImpl: vi.fn().mockResolvedValue(appleResponse({ attribution: false })),
        appleAdsOrgId: 40669820,
      },
    );

    expect(response.status).toBe(503);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'preflight_growth_install_attribution',
      'finalize_growth_apple_attribution',
    ]);
    expect(rpc).not.toHaveBeenCalledWith(
      'record_growth_attribution_upstream_result',
      expect.anything(),
    );
  });

  it('returns an idempotent success for a resolved iOS replay without another Apple call', async () => {
    const { client, rpc } = serviceClient({
      rpc: async (name) => name === 'preflight_growth_install_attribution'
        ? { data: { lease_id: null, already_resolved: true }, error: null }
        : { data: null, error: null },
    });
    const fetchImpl = vi.fn();
    const response = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', {
        installation_id: INSTALL_ID,
        platform: 'ios',
        token: TOKEN,
      }),
      {
        createServiceClient: () => client as never,
        fetchImpl,
        appleAdsOrgId: 40669820,
      },
    );

    expect(response.status).toBe(202);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('returns an idempotent Android success before rate limiting or another write', async () => {
    const { client, rpc } = serviceClient({
      rpc: async (name) => name === 'preflight_growth_install_attribution'
        ? { data: { lease_id: null, already_resolved: true }, error: null }
        : { error: { message: 'must not write a resolved replay' } },
    });
    const response = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', {
        installation_id: INSTALL_ID,
        platform: 'android',
        attribution: { source: 'google' },
      }),
      { createServiceClient: () => client as never },
    );

    expect(response.status).toBe(202);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('does not call Apple when atomic preflight is unavailable', async () => {
    const { client } = serviceClient({
      rpc: async () => ({ error: { message: 'database unavailable' } }),
    });
    const fetchImpl = vi.fn();
    const response = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', {
        installation_id: INSTALL_ID,
        platform: 'ios',
        token: TOKEN,
      }),
      { createServiceClient: () => client as never, fetchImpl, appleAdsOrgId: 40669820 },
    );

    expect(response.status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['attribution_rate_limit_exceeded', 429, 'attribution_rate_limited'],
    ['attribution_global_circuit_breaker_open', 503, 'attribution_capacity_limited'],
  ])('maps database preflight %s to a coarse response', async (message, status, code) => {
    const { client } = serviceClient({
      rpc: async (name) => name === 'preflight_growth_install_attribution'
        ? { error: { message } }
        : { data: {}, error: null },
    });
    const response = await handleInstallAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install', {
        installation_id: INSTALL_ID,
        platform: 'android',
        attribution: {},
      }),
      { createServiceClient: () => client as never },
    );
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(body.error.details.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain(INSTALL_ID);
  });
});

describe('authenticated install/profile linking', () => {
  it('rejects user_id and arbitrary fields in the request body', async () => {
    const { client, rpc } = serviceClient();
    const response = await handleLinkAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install/link', {
        installation_id: INSTALL_ID,
        platform: 'android',
        user_id: 'attacker-selected-user',
      }),
      USER_ID,
      { createServiceClient: () => client as never },
    );

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('requires the current faith_harbor profile before linking a shared auth identity', async () => {
    const { client, rpc } = serviceClient({ profile: null });
    const response = await handleLinkAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install/link', {
        installation_id: INSTALL_ID,
        platform: 'android',
      }),
      USER_ID,
      { createServiceClient: () => client as never },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: 'Vella profile is required before attribution linking',
        details: { code: 'vella_profile_required' },
      },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('links only the server-authenticated current profile and never returns identifiers', async () => {
    const { client, rpc, from, eq } = serviceClient();
    const response = await handleLinkAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install/link', {
        installation_id: INSTALL_ID,
        platform: 'ios',
      }),
      USER_ID,
      { createServiceClient: () => client as never },
    );
    const body = await response.text();

    expect(response.status).toBe(202);
    expect(body).toBe('{"data":{"status":"linked"}}');
    expect(from).toHaveBeenCalledWith('profiles');
    expect(eq).toHaveBeenCalledWith('id', USER_ID);
    expect(rpc).toHaveBeenCalledWith('link_growth_install_profile', {
      p_installation_id: INSTALL_ID,
      p_platform: 'ios',
      p_user_id: USER_ID,
    });
    expect(body).not.toContain(USER_ID);
    expect(body).not.toContain(INSTALL_ID);
  });

  it('maps a thrown link RPC failure to a coarse response without identifiers', async () => {
    const { client } = serviceClient({
      rpc: async () => {
        throw new Error(`database failure for ${USER_ID}/${INSTALL_ID}`);
      },
    });

    const response = await handleLinkAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install/link', {
        installation_id: INSTALL_ID,
        platform: 'android',
      }),
      USER_ID,
      { createServiceClient: () => client as never },
    );
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain(USER_ID);
    expect(body).not.toContain(INSTALL_ID);
  });

  it.each([
    ['attribution_install_missing', 404, 'attribution_install_missing'],
    ['attribution_platform_mismatch', 409, 'attribution_platform_mismatch'],
  ])('maps link RPC %s without leaking identifiers', async (message, status, code) => {
    const { client } = serviceClient({ rpc: async () => ({ error: { message } }) });
    const response = await handleLinkAttributionRequest(
      jsonRequest('https://vella.one/api/v1/attribution/install/link', {
        installation_id: INSTALL_ID,
        platform: 'android',
      }),
      USER_ID,
      { createServiceClient: () => client as never },
    );
    const body = await response.text();

    expect(response.status).toBe(status);
    expect(JSON.parse(body).error.details.code).toBe(code);
    expect(body).not.toContain(USER_ID);
    expect(body).not.toContain(INSTALL_ID);
  });
});
