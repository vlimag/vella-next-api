import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  GATHERING_LOCALES,
  GATHERING_SECTION_TYPES,
  generatedGatheringSchema,
  reviewDecisionSchema,
  type GeneratedGathering,
  type GatheringLocale,
  type ReviewDecision,
} from './contracts';

export type GatheringValidationFailureCode =
  | 'schema_invalid'
  | 'locale_incomplete'
  | 'step_contract_invalid'
  | 'duration_invalid'
  | 'theme_key_invalid'
  | 'bounded_field_invalid'
  | 'scripture_text_forbidden'
  | 'scripture_reference_invalid'
  | 'prohibited_content'
  | 'similarity_too_high'
  | 'release_history_invalid';

export type GatheringValidationResult =
  | { ok: true }
  | { ok: false; code: GatheringValidationFailureCode };

export type RecentGatheringRelease = {
  published_at: string;
  content: GeneratedGathering;
};

export type GatheringValidationContext = {
  recentReleases: readonly RecentGatheringRelease[];
};

export type ReviewValidationResult =
  | { ok: true; decision: ReviewDecision }
  | { ok: false; code: 'schema_invalid' };

const SIMILARITY_THRESHOLD = 0.82;

const prohibitedPatterns: readonly RegExp[] = [
  /\b(?:cure|cures|cured|diagnose|diagnosed|diagnosis)\b[\s\S]{0,80}\b(?:you|your|this|the)\b/i,
  /\b(?:medical|legal|financial)\s+(?:advice|treatment|diagnosis|guarantee)\b/i,
  /\b(?:curará|curaran|curarás|diagnóstico|diagnostico|tratamento médico|conselho jurídico|conseil juridique|medizinische Beratung|consiglio legale|гарант\w*|гарант\w*|gwarant\w*|wylecz\w*)\b/i,
  /\b(?:stop|avoid|replace|skip)\s+(?:your\s+)?(?:medication|medicine|therapy|doctor|treatment)\b/i,
  /\b(?:guaranteed|guarantee|certainly|definitely|always works|will\s+(?:cure|heal|fix|solve))\b/i,
  /\b(?:garantizado|garantizada|garantido|garantida|garanti|garantiert|garantito|garantita|гарант\w*|gwarant\w*)\b/i,
  /\b(?:god|jesus|the bible|scripture)\s+(?:says|said|promises?)\s*[:,-]?\s*["“]/i,
  /\b(?:dios|deus|gott|dio|jesús|jesus|бог|bóg)\s+(?:dice|dijo|diz|disse|sagt|говорит|mówi)\s*[:,-]?\s*["“]/i,
  /["“][^"”\n]{1,500}["”]\s*(?:[-—]\s*)?(?:god|jesus|the bible|scripture)\b/i,
  /\b(?:if you miss|don't leave|do not leave|you must return|come back or|keep your streak|only here)\b/i,
  /\b(?:harm yourself|hurt yourself|end your life|take your own life|do not seek help)\b/i,
  /\b(?:vote for|political party|politician|election campaign|court order|lawsuit)\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?<!\w)\+?\d(?:[\s().-]*\d){7,}(?!\w)/i,
  /\b(?:user[_ -]?id|account[_ -]?id|receipt|purchase[_ -]?token|raw[_ -]?(?:prayer|journal)|private[_ -]?(?:prayer|journal|note)[_ -]?(?:text|content|body|payload))\b/i,
];

const forbiddenScriptureKeys = new Set([
  'scripture_text',
  'scripture_body',
  'verse_text',
  'verse_body',
  'bible_text',
  'bible_body',
]);

const recentReleaseSchema = z.object({
  published_at: z.string().datetime({ offset: true }),
  content: generatedGatheringSchema,
}).strict();

export function validateGatheringCandidate(
  candidate: unknown,
  context: GatheringValidationContext,
): GatheringValidationResult {
  if (containsForbiddenScriptureKey(candidate)) return { ok: false, code: 'scripture_text_forbidden' };

  if (hasScriptureStepBody(candidate)) return { ok: false, code: 'scripture_text_forbidden' };

  if (containsProhibitedPattern(candidateStrings(candidate))) {
    return { ok: false, code: 'prohibited_content' };
  }

  const structuralFailure = inspectStructure(candidate);
  if (structuralFailure) return structuralFailure;

  const parsed = generatedGatheringSchema.safeParse(candidate);
  if (!parsed.success) return classifySchemaFailure(candidate, parsed.error.issues);

  const history = validateRecentReleases(isRecord(context) ? context.recentReleases : undefined);
  if (!history.ok) return history;

  if (history.releases.some((prior) => releaseSimilarity(parsed.data, prior.content) > SIMILARITY_THRESHOLD)) {
    return { ok: false, code: 'similarity_too_high' };
  }

  return { ok: true };
}

export function validateReviewDecision(value: unknown): ReviewValidationResult {
  const parsed = reviewDecisionSchema.safeParse(value);
  return parsed.success
    ? { ok: true, decision: parsed.data }
    : { ok: false, code: 'schema_invalid' };
}

export function candidateContentHash(candidate: unknown): string {
  const parsed = generatedGatheringSchema.parse(candidate);
  const normalized = canonicalize(contentProjection(parsed));
  return createHash('sha256').update(JSON.stringify(normalized), 'utf8').digest('hex');
}

function inspectStructure(candidate: unknown): GatheringValidationResult | null {
  if (!isRecord(candidate)) return { ok: false, code: 'schema_invalid' };

  const locales = candidate.locales;
  if (!isRecord(locales)) return { ok: false, code: 'locale_incomplete' };
  if (GATHERING_LOCALES.some((locale) => !(locale in locales))) {
    return { ok: false, code: 'locale_incomplete' };
  }
  if (Object.keys(locales).some((locale) => !GATHERING_LOCALES.includes(locale as GatheringLocale))) {
    return { ok: false, code: 'locale_incomplete' };
  }

  for (const locale of GATHERING_LOCALES) {
    const localized = locales[locale];
    if (!isRecord(localized) || !Array.isArray(localized.steps) || localized.steps.length !== 8) {
      return { ok: false, code: 'step_contract_invalid' };
    }
    const sectionTypes = localized.steps.map((step) => isRecord(step) ? step.section_type : undefined);
    if (sectionTypes.some((section, index) => section !== GATHERING_SECTION_TYPES[index])) {
      return { ok: false, code: 'step_contract_invalid' };
    }
    if (isRecord(localized.steps[2]) && Object.keys(localized.steps[2]).some((key) => key !== 'section_type')) {
      return { ok: false, code: 'scripture_text_forbidden' };
    }
  }

  return null;
}

function classifySchemaFailure(
  candidate: unknown,
  issues: readonly { path: PropertyKey[] }[],
): GatheringValidationResult {
  if (issues.some(({ path }) => path.includes('estimated_duration_seconds'))) {
    return { ok: false, code: 'duration_invalid' };
  }
  if (issues.some(({ path }) => path.includes('theme_key'))) {
    return { ok: false, code: 'theme_key_invalid' };
  }
  if (issues.some(({ path }) => path.includes('scripture_reference'))) {
    return { ok: false, code: 'scripture_reference_invalid' };
  }
  if (issues.some(({ path }) => path.includes('title') || path.includes('summary') || path.includes('body'))) {
    return { ok: false, code: 'bounded_field_invalid' };
  }
  if (isRecord(candidate) && typeof candidate.scripture_reference !== 'string') {
    return { ok: false, code: 'bounded_field_invalid' };
  }
  return { ok: false, code: 'schema_invalid' };
}

function contentProjection(candidate: GeneratedGathering) {
  return {
    theme_key: candidate.theme_key,
    scripture_reference: candidate.scripture_reference,
    estimated_duration_seconds: candidate.estimated_duration_seconds,
    locales: Object.fromEntries(GATHERING_LOCALES.map((locale) => [locale, {
      title: candidate.locales[locale].title,
      summary: candidate.locales[locale].summary,
      steps: candidate.locales[locale].steps,
    }])),
  };
}

function releaseSimilarity(candidate: GeneratedGathering, prior: GeneratedGathering): number {
  return jaccardSimilarity(canonicalContentText(candidate), canonicalContentText(prior));
}

function canonicalContentText(candidate: GeneratedGathering): string {
  return JSON.stringify(canonicalize(contentProjection(candidate)));
}

function jaccardSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokens(left));
  const rightTokens = new Set(tokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return intersection / (leftTokens.size + rightTokens.size - intersection);
}

function tokens(value: string): string[] {
  const words = value.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length < 3) return words;
  return words.slice(0, -2).map((_, index) => words.slice(index, index + 3).join(' '));
}

function containsForbiddenScriptureKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenScriptureKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, entry]) => {
    return forbiddenScriptureKeys.has(key.toLowerCase()) || containsForbiddenScriptureKey(entry);
  });
}

function hasScriptureStepBody(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.locales)) return false;
  const locales = value.locales;
  return GATHERING_LOCALES.some((locale) => {
    const localized = locales[locale];
    if (!isRecord(localized) || !Array.isArray(localized.steps)) return false;
    const scriptureStep = localized.steps[2];
    return isRecord(scriptureStep)
      && scriptureStep.section_type === 'scripture'
      && Object.keys(scriptureStep).some((key) => key !== 'section_type');
  });
}

function candidateStrings(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(candidateStrings).join('\n');
  if (isRecord(value)) return Object.entries(value)
    .map(([key, entry]) => `${key}\n${candidateStrings(entry)}`)
    .join('\n');
  return '';
}

function containsProhibitedPattern(value: string): boolean {
  return prohibitedPatterns.some((pattern) => pattern.test(value));
}

function validateRecentReleases(
  releases: unknown,
): { ok: true; releases: readonly RecentGatheringRelease[] } | { ok: false; code: 'release_history_invalid' } {
  if (!Array.isArray(releases) || releases.length > 12) {
    return { ok: false, code: 'release_history_invalid' };
  }

  let previousPublishedAt: number | undefined;
  const parsedReleases: RecentGatheringRelease[] = [];
  for (const release of releases) {
    if (!isRecord(release) || Object.keys(release).some((key) => key !== 'published_at' && key !== 'content')) {
      return { ok: false, code: 'release_history_invalid' };
    }
    const parsedRelease = recentReleaseSchema.safeParse(release);
    if (!parsedRelease.success) return { ok: false, code: 'release_history_invalid' };
    const publishedAt = Date.parse(parsedRelease.data.published_at);
    if (previousPublishedAt !== undefined && previousPublishedAt <= publishedAt) {
      return { ok: false, code: 'release_history_invalid' };
    }
    previousPublishedAt = publishedAt;
    parsedReleases.push(parsedRelease.data);
  }
  return { ok: true, releases: parsedReleases };
}

function canonicalize(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.normalize('NFC').replace(/\u00a0/gu, ' ').replace(/\s+/gu, ' ').trim();
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
