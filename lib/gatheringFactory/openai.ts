import {
  GATHERING_LOCALES,
  GATHERING_SECTION_TYPES,
  GATHERING_THEME_KEYS,
  generatedGatheringSchema,
  reviewDecisionSchema,
  type GeneratedGathering,
  type GatheringLocale,
  type ReviewDecision,
} from './contracts';
import { validateReviewDecision } from './validators';

export const GATHERING_PROMPT_REVISION = 'gathering-factory.1' as const;
export const GATHERING_MODEL = 'gpt-5.6-luna' as const;

export type FactoryDeps = {
  fetch: typeof fetch;
  apiKey: string;
  now: () => Date;
  timeoutMs: number;
  maxInputTokens: number;
  maxOutputTokens: number;
};

export type GatheringGenerationInput = {
  themeKey: GeneratedGathering['theme_key'];
  slotType: 'monday' | 'thursday';
};

export type FactoryUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type CanonicalScripture = {
  id: string;
  locale: GatheringLocale;
  text: string;
};

export type CanonicalScriptureRepository = {
  findApprovedByReference: (
    reference: string,
    locales: readonly GatheringLocale[],
  ) => Promise<readonly CanonicalScripture[]>;
};

export class GatheringFactoryError extends Error {
  constructor(
    public readonly code:
      | 'openai_timeout'
      | 'openai_http'
      | 'openai_malformed_json'
      | 'draft_schema_invalid'
      | 'review_schema_invalid'
      | 'review_rejected'
      | 'token_budget_exceeded'
      | 'canonical_scripture_missing'
      | 'canonical_scripture_query_failed',
    message = code,
  ) {
    super(message);
    this.name = 'GatheringFactoryError';
  }
}

const generatedGatheringJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'theme_key', 'scripture_reference', 'estimated_duration_seconds', 'locales'],
  properties: {
    schema_version: { type: 'integer', const: 1 },
    theme_key: { type: 'string', enum: [...GATHERING_THEME_KEYS] },
    scripture_reference: { type: 'string', maxLength: 160 },
    estimated_duration_seconds: { type: 'integer', minimum: 720, maximum: 1080 },
    locales: {
      type: 'object',
      additionalProperties: false,
      required: [...GATHERING_LOCALES],
      properties: Object.fromEntries(GATHERING_LOCALES.map((locale) => [locale, {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'summary', 'steps'],
        properties: {
          title: { type: 'string', maxLength: 160 },
          summary: { type: 'string', maxLength: 800 },
          steps: {
            type: 'array',
            minItems: 8,
            maxItems: 8,
            items: {
              anyOf: GATHERING_SECTION_TYPES.map((sectionType) => sectionType === 'scripture'
                ? {
                  type: 'object',
                  additionalProperties: false,
                  required: ['section_type'],
                  properties: { section_type: { type: 'string', const: 'scripture' } },
                }
                : {
                  type: 'object',
                  additionalProperties: false,
                  required: ['section_type', 'body'],
                  properties: {
                    section_type: { type: 'string', const: sectionType },
                    body: { type: 'string', maxLength: 4_000 },
                  },
                }),
            },
            prefixItems: GATHERING_SECTION_TYPES.map((sectionType) => sectionType === 'scripture'
              ? {
                type: 'object',
                additionalProperties: false,
                required: ['section_type'],
                properties: { section_type: { type: 'string', const: 'scripture' } },
              }
              : {
                type: 'object',
                additionalProperties: false,
                required: ['section_type', 'body'],
                properties: {
                  section_type: { type: 'string', const: sectionType },
                  body: { type: 'string', maxLength: 4_000 },
                },
              }),
          },
        },
      }])),
    },
  },
} as const;

const reviewDecisionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['approved', 'reasons'],
  properties: {
    approved: { type: 'boolean' },
    reasons: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string', maxLength: 500 },
    },
  },
} as const;

export async function generateGatheringDraft(
  input: GatheringGenerationInput,
  deps: FactoryDeps,
): Promise<{
  draft: GeneratedGathering;
  usage: FactoryUsage;
  request: Record<string, unknown>;
}> {
  const request: Record<string, unknown> = {
    model: GATHERING_MODEL,
    store: false,
    metadata: { prompt_revision: GATHERING_PROMPT_REVISION },
    input: [
      {
        role: 'system',
        content: 'Create one safe, warm, denomination-neutral Christian Gathering. Return only the requested structured object. Select an approved Scripture reference; never write Scripture text. Never use quotation marks or attribute direct words to God, Jesus, the Bible, or Scripture. Avoid cure, healing, or guarantee claims and all private identifiers.',
      },
      {
        role: 'user',
        content: JSON.stringify({ theme_key: input.themeKey, slot_type: input.slotType }),
      },
    ],
    max_output_tokens: deps.maxOutputTokens,
    text: {
      format: {
        type: 'json_schema',
        name: 'gathering_draft',
        strict: true,
        schema: generatedGatheringJsonSchema,
      },
    },
  };

  const response = await callResponsesApi(request, deps);
  const usage = parseUsage(response.usage);
  enforceUsageBudget(usage, deps);
  const draft = parseStructuredOutput(response, 'draft_schema_invalid');
  const parsed = generatedGatheringSchema.safeParse(draft);
  if (!parsed.success) throw new GatheringFactoryError('draft_schema_invalid');
  return { draft: parsed.data, usage, request };
}

export async function reviewGatheringDraft(
  draft: GeneratedGathering,
  deps: FactoryDeps,
): Promise<{
  decision: ReviewDecision;
  usage: FactoryUsage;
  request: Record<string, unknown>;
}> {
  const candidate = generatedGatheringSchema.safeParse(draft);
  if (!candidate.success) throw new GatheringFactoryError('draft_schema_invalid');

  const request: Record<string, unknown> = {
    model: GATHERING_MODEL,
    store: false,
    metadata: { prompt_revision: GATHERING_PROMPT_REVISION },
    input: [
      {
        role: 'system',
        content: 'Review this Gathering for schema completeness, safe denomination-neutral Christian tone, canonical Scripture reference-only usage, and prohibited medical, political, manipulative, or private-data content. Approve only if all checks pass.',
      },
      { role: 'user', content: JSON.stringify(candidate.data) },
    ],
    max_output_tokens: deps.maxOutputTokens,
    text: {
      format: {
        type: 'json_schema',
        name: 'gathering_review',
        strict: true,
        schema: reviewDecisionJsonSchema,
      },
    },
  };

  const response = await callResponsesApi(request, deps);
  const usage = parseUsage(response.usage);
  enforceUsageBudget(usage, deps);
  const parsed = reviewDecisionSchema.safeParse(parseStructuredOutput(response, 'review_schema_invalid'));
  if (!parsed.success) throw new GatheringFactoryError('review_schema_invalid');
  const validated = validateReviewDecision(parsed.data);
  if (!validated.ok || !validated.decision.approved) throw new GatheringFactoryError('review_rejected');
  return { decision: validated.decision, usage, request };
}

export async function resolveCanonicalScripture(
  reference: string,
  repository: CanonicalScriptureRepository,
): Promise<Record<GatheringLocale, CanonicalScripture>> {
  let rows: readonly CanonicalScripture[];
  try {
    rows = await repository.findApprovedByReference(reference, GATHERING_LOCALES);
  } catch {
    throw new GatheringFactoryError('canonical_scripture_query_failed');
  }

  const resolved = new Map<GatheringLocale, CanonicalScripture>();
  for (const row of rows) {
    if (!GATHERING_LOCALES.includes(row.locale) || !row.id || !row.text.trim() || resolved.has(row.locale)) {
      throw new GatheringFactoryError('canonical_scripture_missing');
    }
    resolved.set(row.locale, row);
  }
  if (resolved.size !== GATHERING_LOCALES.length) {
    throw new GatheringFactoryError('canonical_scripture_missing');
  }
  return Object.fromEntries(GATHERING_LOCALES.map((locale) => [locale, resolved.get(locale)!])) as Record<GatheringLocale, CanonicalScripture>;
}

async function callResponsesApi(
  request: Record<string, unknown>,
  deps: FactoryDeps,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await deps.fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${deps.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(deps.timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') throw new GatheringFactoryError('openai_timeout');
    throw new GatheringFactoryError('openai_http');
  }
  if (!response.ok) throw new GatheringFactoryError('openai_http');
  try {
    const body: unknown = await response.json();
    if (!isRecord(body)) throw new Error('not an object');
    return body;
  } catch {
    throw new GatheringFactoryError('openai_malformed_json');
  }
}

function parseStructuredOutput(response: Record<string, unknown>, schemaFailure: 'draft_schema_invalid' | 'review_schema_invalid'): unknown {
  const outputText = response.output_text;
  if (typeof outputText === 'string') {
    try {
      return JSON.parse(outputText) as unknown;
    } catch {
      throw new GatheringFactoryError('openai_malformed_json');
    }
  }
  if (Array.isArray(response.output)) {
    const text = response.output.flatMap((item) => isRecord(item) && Array.isArray(item.content) ? item.content : [])
      .map((item) => isRecord(item) && typeof item.text === 'string' ? item.text : '')
      .join('');
    if (text) {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new GatheringFactoryError('openai_malformed_json');
      }
    }
  }
  throw new GatheringFactoryError(schemaFailure);
}

function parseUsage(value: unknown): FactoryUsage {
  if (!isRecord(value)
    || typeof value.input_tokens !== 'number'
    || typeof value.output_tokens !== 'number'
    || !Number.isSafeInteger(value.input_tokens)
    || !Number.isSafeInteger(value.output_tokens)
    || value.input_tokens < 0
    || value.output_tokens < 0) {
    return { inputTokens: 0, outputTokens: 0 };
  }
  return { inputTokens: value.input_tokens, outputTokens: value.output_tokens };
}

function enforceUsageBudget(usage: FactoryUsage, deps: FactoryDeps): void {
  if (usage.inputTokens > deps.maxInputTokens || usage.outputTokens > deps.maxOutputTokens) {
    throw new GatheringFactoryError('token_budget_exceeded');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
