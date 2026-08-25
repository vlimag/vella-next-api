import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';

export const APPLE_ATTRIBUTION_ENDPOINT = 'https://api-adservices.apple.com/api/v1/';
export const MAX_ATTRIBUTION_REQUEST_BYTES = 8 * 1024;
const MAX_APPLE_RESPONSE_BYTES = 8 * 1024;
const APPLE_REQUEST_TIMEOUT_MS = 5_000;
const APPLE_EARLY_RETRY_MS = 5_000;
const APPLE_MAX_ATTEMPTS = 3;

const uuidSchema = z.string().uuid();
const platformSchema = z.enum(['ios', 'android']);
const shortCodeSchema = z.string().min(1).max(32).regex(/^[a-z0-9][a-z0-9._~-]*$/);
const campaignCodeSchema = z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9._~-]*$/);
// AdServices tokens are opaque. Keep only transport-safety bounds and forward
// the exact visible-ASCII value; do not assume base64/JWT structure.
const appleTokenSchema = z.string().min(16).max(4096).regex(/^[\x21-\x7e]+$/);

const androidInstallSchema = z.object({
  installation_id: uuidSchema,
  platform: z.literal('android'),
  attribution: z.object({
    source: shortCodeSchema.optional(),
    medium: shortCodeSchema.optional(),
    campaign: campaignCodeSchema.optional(),
    creative_code: campaignCodeSchema.optional(),
  }).strict(),
}).strict();

const iosInstallSchema = z.object({
  installation_id: uuidSchema,
  platform: z.literal('ios'),
  token: appleTokenSchema,
}).strict();

export const attributionInstallSchema = z.discriminatedUnion('platform', [
  androidInstallSchema,
  iosInstallSchema,
]);

const attributionLinkSchema = z.object({
  installation_id: uuidSchema,
  platform: platformSchema,
}).strict();

const applePositiveInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const applePlacementSchema = z.enum([
  'APPSTORE_PRODUCT_PAGES',
  'APPSTORE_SEARCH_RESULTS',
  'APPSTORE_SEARCH_TAB',
  'APPSTORE_TODAY_TAB',
]);
const appleDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z$/);

const appleAttributedSchema = z.object({
  attribution: z.literal(true),
  orgId: applePositiveInteger,
  campaignId: applePositiveInteger,
  conversionType: z.enum(['Download', 'Redownload', 'PreOrder']),
  claimType: z.enum(['Click', 'Impression']),
  adGroupId: applePositiveInteger,
  countryOrRegion: z.string().regex(/^[A-Z]{2}$/),
  keywordId: applePositiveInteger.optional(),
  adId: applePositiveInteger.optional(),
  supplyPlacement: applePlacementSchema.optional(),
  clickDate: appleDateSchema.optional(),
  impressionDate: appleDateSchema.optional(),
}).passthrough().superRefine((payload, context) => {
  if (payload.clickDate && payload.claimType !== 'Click') {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'clickDate requires Click' });
  }
  if (payload.impressionDate && payload.claimType !== 'Impression') {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'impressionDate requires Impression' });
  }
  if (payload.clickDate && payload.impressionDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'only one attribution date is allowed' });
  }
});

const appleUnattributedSchema = z.object({ attribution: z.literal(false) })
  .passthrough()
  .superRefine((payload, context) => {
    for (const key of [
      'orgId', 'campaignId', 'conversionType', 'claimType', 'adGroupId',
      'countryOrRegion', 'keywordId', 'adId', 'supplyPlacement', 'clickDate',
      'impressionDate',
    ]) {
      if (key in payload) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'non-attributed payload cannot contain attribution fields',
          path: [key],
        });
      }
    }
  });
const applePayloadSchema = z.union([appleUnattributedSchema, appleAttributedSchema]);

export type AppleCoarseAttribution = {
  provider: 'apple_ads';
  org_id: number;
  campaign_id: number;
  ad_group_id: number;
  keyword_id: number | null;
  ad_id: number | null;
  supply_placement: z.infer<typeof applePlacementSchema> | null;
  conversion_type: z.infer<typeof appleAttributedSchema>['conversionType'];
};

type AppleParsedResult =
  | { kind: 'attributed'; attribution: AppleCoarseAttribution }
  | { kind: 'unattributed' }
  | { kind: 'invalid' };

export type AppleExchangeResult =
  | Exclude<AppleParsedResult, { kind: 'invalid' }>
  | { kind: 'invalid_token' }
  | { kind: 'invalid_response' }
  | { kind: 'retryable'; reason: 'not_ready' | 'upstream_unavailable' };

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type Sleep = (milliseconds: number) => Promise<void>;
type ServiceClient = ReturnType<typeof createServiceClient>;

type AttributionDependencies = {
  createServiceClient?: () => ServiceClient;
  fetchImpl?: Fetch;
  sleep?: Sleep;
  appleTimeoutMs?: number;
  appleAdsOrgId?: number;
};

function noStore<T extends Response>(response: T): T {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function invalidInput(code: string) {
  return noStore(fail('Invalid attribution request', 400, { code }));
}

async function readBoundedJson(
  request: Request,
): Promise<{ body: unknown } | { response: Response }> {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return {
      response: noStore(fail('Content-Type must be application/json', 415, {
        code: 'content_type_required',
      })),
    };
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (!Number.isFinite(declaredBytes) || declaredBytes < 0) {
      return { response: invalidInput('content_length_invalid') };
    }
    if (declaredBytes > MAX_ATTRIBUTION_REQUEST_BYTES) {
      return {
        response: noStore(fail('Attribution request is too large', 413, {
          code: 'request_too_large',
        })),
      };
    }
  }

  const bounded = await readBoundedStream(request.body, MAX_ATTRIBUTION_REQUEST_BYTES);
  if (bounded.kind === 'too_large') {
    return {
      response: noStore(fail('Attribution request is too large', 413, {
        code: 'request_too_large',
      })),
    };
  }
  if (bounded.kind === 'unreadable') return { response: invalidInput('body_unreadable') };

  try {
    return { body: JSON.parse(bounded.text) as unknown };
  } catch {
    return { response: invalidInput('invalid_json') };
  }
}

async function readBoundedStream(
  stream: ReadableStream<Uint8Array> | null,
  maximumBytes: number,
): Promise<{ kind: 'ok'; text: string } | { kind: 'too_large' } | { kind: 'unreadable' }> {
  if (!stream) return { kind: 'ok', text: '' };

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        return { kind: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { kind: 'unreadable' };
  } finally {
    reader.releaseLock();
  }

  return { kind: 'ok', text: Buffer.concat(chunks).toString('utf8') };
}

export function parseAppleAttributionPayload(text: string): AppleParsedResult {
  if (Buffer.byteLength(text, 'utf8') > MAX_APPLE_RESPONSE_BYTES) {
    return { kind: 'invalid' };
  }

  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return { kind: 'invalid' };
  }

  const parsed = applePayloadSchema.safeParse(body);
  if (!parsed.success) return { kind: 'invalid' };
  if (!parsed.data.attribution) return { kind: 'unattributed' };

  return {
    kind: 'attributed',
    attribution: {
      provider: 'apple_ads',
      org_id: parsed.data.orgId,
      campaign_id: parsed.data.campaignId,
      ad_group_id: parsed.data.adGroupId,
      keyword_id: parsed.data.keywordId ?? null,
      ad_id: parsed.data.adId ?? null,
      supply_placement: parsed.data.supplyPlacement ?? null,
      conversion_type: parsed.data.conversionType,
    },
  };
}

async function fetchAppleOnce(token: string, fetchImpl: Fetch, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(APPLE_ATTRIBUTION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: token,
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function exchangeAppleAttribution(
  token: string,
  dependencies: Pick<AttributionDependencies, 'fetchImpl' | 'sleep' | 'appleTimeoutMs'> = {},
): Promise<AppleExchangeResult> {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const sleep = dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  }));
  const timeoutMs = dependencies.appleTimeoutMs ?? APPLE_REQUEST_TIMEOUT_MS;

  for (let attempt = 1; attempt <= APPLE_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetchAppleOnce(token, fetchImpl, timeoutMs);
    } catch {
      return { kind: 'retryable', reason: 'upstream_unavailable' };
    }

    if (response.status === 404) {
      if (attempt < APPLE_MAX_ATTEMPTS) {
        await sleep(APPLE_EARLY_RETRY_MS);
        continue;
      }
      return { kind: 'retryable', reason: 'not_ready' };
    }
    if (response.status === 400) return { kind: 'invalid_token' };
    if (response.status >= 500) {
      return { kind: 'retryable', reason: 'upstream_unavailable' };
    }
    if (response.status !== 200) return { kind: 'invalid_response' };

    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_APPLE_RESPONSE_BYTES) {
      return { kind: 'invalid_response' };
    }
    const bounded = await readBoundedStream(response.body, MAX_APPLE_RESPONSE_BYTES);
    if (bounded.kind !== 'ok') return { kind: 'invalid_response' };
    const parsed = parseAppleAttributionPayload(bounded.text);
    return parsed.kind === 'invalid' ? { kind: 'invalid_response' } : parsed;
  }

  return { kind: 'retryable', reason: 'not_ready' };
}

function databaseFailure() {
  return noStore(fail('Could not record install attribution', 503, {
    code: 'attribution_storage_unavailable',
  }));
}

function preflightFailure(error: { message?: string } | null) {
  if (error?.message === 'attribution_rate_limit_exceeded' ||
      error?.message === 'attribution_install_lease_active') {
    return noStore(fail('Too many attribution requests', 429, {
      code: 'attribution_rate_limited',
    }));
  }
  if (error?.message === 'attribution_global_circuit_breaker_open') {
    return noStore(fail('Attribution capture is temporarily at capacity', 503, {
      code: 'attribution_capacity_limited',
    }));
  }
  return databaseFailure();
}

function recordParameters(
  installationId: string,
  platform: 'ios' | 'android',
  values: {
    provider?: 'apple_ads' | 'play_install_referrer' | null;
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    creative_code?: string | null;
    org_id?: number | null;
    campaign_id?: number | null;
    ad_group_id?: number | null;
    keyword_id?: number | null;
    ad_id?: number | null;
    supply_placement?: string | null;
    conversion_type?: 'Download' | 'Redownload' | 'PreOrder' | null;
    attributed: boolean;
  },
) {
  return {
    p_installation_id: installationId,
    p_platform: platform,
    p_provider: values.provider ?? null,
    p_source: values.source ?? null,
    p_medium: values.medium ?? null,
    p_campaign: values.campaign ?? null,
    p_creative_code: values.creative_code ?? null,
    p_org_id: values.org_id ?? null,
    p_campaign_id: values.campaign_id ?? null,
    p_ad_group_id: values.ad_group_id ?? null,
    p_keyword_id: values.keyword_id ?? null,
    p_ad_id: values.ad_id ?? null,
    p_supply_placement: values.supply_placement ?? null,
    p_conversion_type: values.conversion_type ?? null,
    p_resolution_status: 'resolved',
    p_attributed: values.attributed,
  };
}

async function recordAttribution(
  supabase: ServiceClient,
  parameters: ReturnType<typeof recordParameters>,
) {
  try {
    const { error } = await supabase.rpc('record_growth_install_attribution', parameters);
    return error ? databaseFailure() : null;
  } catch {
    return databaseFailure();
  }
}

type PreflightDecision = { leaseId: string | null; alreadyResolved: boolean };

function extractPreflightDecision(data: unknown): PreflightDecision | null {
  if (Array.isArray(data) && data.length === 1) return extractPreflightDecision(data[0]);
  if (!data || typeof data !== 'object') return null;
  const value = data as { lease_id?: unknown; already_resolved?: unknown };
  const leaseId = value.lease_id === null || value.lease_id === undefined
    ? null
    : typeof value.lease_id === 'string' && uuidSchema.safeParse(value.lease_id).success
      ? value.lease_id
      : undefined;
  if (leaseId === undefined || typeof value.already_resolved !== 'boolean') return null;
  return { leaseId, alreadyResolved: value.already_resolved };
}

async function completeAppleLease(
  supabase: ServiceClient,
  installationId: string,
  leaseId: string,
  outcome: 'success' | 'neutral' | 'upstream_failure',
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('record_growth_attribution_upstream_result', {
      p_installation_id: installationId,
      p_lease_id: leaseId,
      p_outcome: outcome,
    });
    return !error;
  } catch {
    return false;
  }
}

async function finalizeAppleAttribution(
  supabase: ServiceClient,
  installationId: string,
  leaseId: string,
  attribution: AppleCoarseAttribution | null,
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('finalize_growth_apple_attribution', {
      p_installation_id: installationId,
      p_lease_id: leaseId,
      p_attributed: attribution !== null,
      p_org_id: attribution?.org_id ?? null,
      p_campaign_id: attribution?.campaign_id ?? null,
      p_ad_group_id: attribution?.ad_group_id ?? null,
      p_keyword_id: attribution?.keyword_id ?? null,
      p_ad_id: attribution?.ad_id ?? null,
      p_supply_placement: attribution?.supply_placement ?? null,
      p_conversion_type: attribution?.conversion_type ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}

function leaseCompletionFailure() {
  return noStore(fail('Could not finalize Apple attribution', 503, {
    code: 'attribution_lease_completion_unavailable',
  }));
}

function resolveAppleAdsOrgId(dependencies: AttributionDependencies): number | null {
  const rawValue = dependencies.appleAdsOrgId ?? process.env.APPLE_ADS_ORG_ID;
  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function handleInstallAttributionRequest(
  request: Request,
  dependencies: AttributionDependencies = {},
): Promise<Response> {
  const bounded = await readBoundedJson(request);
  if ('response' in bounded) return bounded.response;
  const parsed = attributionInstallSchema.safeParse(bounded.body);
  if (!parsed.success) return invalidInput('schema_invalid');

  const appleAdsOrgId = parsed.data.platform === 'ios'
    ? resolveAppleAdsOrgId(dependencies)
    : null;
  if (parsed.data.platform === 'ios' && appleAdsOrgId === null) {
    return noStore(fail('Apple attribution is not configured', 503, {
      code: 'apple_attribution_not_configured',
    }));
  }

  let supabase: ServiceClient;
  try {
    supabase = (dependencies.createServiceClient ?? createServiceClient)();
  } catch {
    return databaseFailure();
  }

  let preflightData: unknown;
  let preflightError: { message?: string } | null;
  try {
    const hasAttribution = parsed.data.platform === 'android'
      ? Object.keys(parsed.data.attribution).length > 0
      : false;
    const preflight = await supabase.rpc('preflight_growth_install_attribution', {
      p_installation_id: parsed.data.installation_id,
      p_platform: parsed.data.platform,
      p_has_attribution: hasAttribution,
    });
    preflightData = preflight.data;
    preflightError = preflight.error;
  } catch {
    return databaseFailure();
  }
  if (preflightError) return preflightFailure(preflightError);
  const preflight = extractPreflightDecision(preflightData);
  if (!preflight) return databaseFailure();
  if (preflight.alreadyResolved) {
    return noStore(ok({ status: 'accepted' as const }, { status: 202 }));
  }

  if (parsed.data.platform === 'android') {
    const attributed = Object.keys(parsed.data.attribution).length > 0;
    const recordError = await recordAttribution(
      supabase,
      recordParameters(parsed.data.installation_id, 'android', {
        provider: attributed ? 'play_install_referrer' : null,
        ...parsed.data.attribution,
        attributed,
      }),
    );
    if (recordError) return recordError;
    return noStore(ok({ status: 'accepted' as const }, { status: 202 }));
  }

  const leaseId = preflight.leaseId;
  if (!leaseId) return databaseFailure();

  const exchange = await exchangeAppleAttribution(parsed.data.token, dependencies);
  if (exchange.kind === 'attributed') {
    if (exchange.attribution.org_id !== appleAdsOrgId) {
      const completed = await completeAppleLease(
        supabase,
        parsed.data.installation_id,
        leaseId,
        'neutral',
      );
      if (!completed) return leaseCompletionFailure();
      return noStore(fail('Apple attribution organization does not match Vella', 422, {
        code: 'apple_attribution_org_mismatch',
      }));
    }
    const finalized = await finalizeAppleAttribution(
      supabase,
      parsed.data.installation_id,
      leaseId,
      exchange.attribution,
    );
    if (!finalized) return leaseCompletionFailure();
    return noStore(ok({ status: 'accepted' as const }, { status: 202 }));
  }
  if (exchange.kind === 'unattributed') {
    const finalized = await finalizeAppleAttribution(
      supabase,
      parsed.data.installation_id,
      leaseId,
      null,
    );
    if (!finalized) return leaseCompletionFailure();
    return noStore(ok({ status: 'accepted' as const }, { status: 202 }));
  }

  const outcome = exchange.kind === 'retryable' && exchange.reason === 'upstream_unavailable'
    ? 'upstream_failure'
    : 'neutral';
  const completed = await completeAppleLease(
    supabase,
    parsed.data.installation_id,
    leaseId,
    outcome,
  );
  if (!completed) return leaseCompletionFailure();

  if (exchange.kind === 'invalid_token') {
    return noStore(fail('Apple attribution token is invalid', 422, {
      code: 'apple_token_invalid',
    }));
  }
  if (exchange.kind === 'invalid_response') {
    return noStore(fail('Apple attribution response was invalid', 502, {
      code: 'apple_attribution_invalid_response',
    }));
  }
  if (exchange.reason === 'not_ready') {
    const response = noStore(fail('Apple attribution is not ready yet', 503, {
      code: 'apple_attribution_retryable',
      retry_after_seconds: 5,
    }));
    response.headers.set('Retry-After', '5');
    return response;
  }
  return noStore(fail('Apple attribution is temporarily unavailable', 503, {
    code: 'apple_attribution_unavailable',
  }));
}

export async function handleLinkAttributionRequest(
  request: Request,
  currentUserId: string,
  dependencies: Pick<AttributionDependencies, 'createServiceClient'> = {},
): Promise<Response> {
  if (!uuidSchema.safeParse(currentUserId).success) {
    return noStore(fail('Invalid auth token', 401, { code: 'authentication_invalid' }));
  }

  const bounded = await readBoundedJson(request);
  if ('response' in bounded) return bounded.response;
  const parsed = attributionLinkSchema.safeParse(bounded.body);
  if (!parsed.success) return invalidInput('schema_invalid');

  let supabase: ServiceClient;
  try {
    supabase = (dependencies.createServiceClient ?? createServiceClient)();
  } catch {
    return databaseFailure();
  }

  let profile: { id?: unknown } | null;
  let profileError: { message?: string } | null;
  try {
    const profileResult = await supabase
      .from('profiles')
      .select('id')
      .eq('id', currentUserId)
      .maybeSingle();
    profile = profileResult.data;
    profileError = profileResult.error;
  } catch {
    return noStore(fail('Could not verify Vella profile', 503, {
      code: 'vella_profile_verification_unavailable',
    }));
  }
  if (profileError) {
    return noStore(fail('Could not verify Vella profile', 503, {
      code: 'vella_profile_verification_unavailable',
    }));
  }
  if (!profile) {
    return noStore(fail('Vella profile is required before attribution linking', 409, {
      code: 'vella_profile_required',
    }));
  }

  let error: { message?: string } | null;
  try {
    const linkResult = await supabase.rpc('link_growth_install_profile', {
      p_installation_id: parsed.data.installation_id,
      p_platform: parsed.data.platform,
      p_user_id: currentUserId,
    });
    error = linkResult.error;
  } catch {
    return databaseFailure();
  }
  if (error?.message === 'attribution_install_missing') {
    return noStore(fail('Install attribution was not found', 404, {
      code: 'attribution_install_missing',
    }));
  }
  if (error?.message === 'attribution_platform_mismatch') {
    return noStore(fail('Install attribution platform does not match', 409, {
      code: 'attribution_platform_mismatch',
    }));
  }
  if (error) return databaseFailure();

  return noStore(ok({ status: 'linked' as const }, { status: 202 }));
}
