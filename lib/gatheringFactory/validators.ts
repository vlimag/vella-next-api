import { createHash } from 'node:crypto';
import {
  GATHERING_LOCALES,
  GATHERING_SECTION_TYPES,
  generatedGatheringSchema,
  type GeneratedGathering,
  type GatheringLocale,
} from './contracts';

export type GatheringValidationFailureCode =
  | 'schema_invalid'
  | 'locale_incomplete'
  | 'step_contract_invalid'
  | 'duration_invalid'
  | 'theme_key_invalid'
  | 'bounded_field_invalid'
  | 'scripture_text_forbidden'
  | 'prohibited_content'
  | 'similarity_too_high';

export type GatheringValidationResult =
  | { ok: true }
  | { ok: false; code: GatheringValidationFailureCode };

export type GatheringValidationContext = {
  recentReleases?: readonly unknown[];
  last12Releases?: readonly unknown[];
  priorReleases?: readonly unknown[];
  recentContent?: readonly unknown[];
  similarityThreshold?: number;
  [key: string]: unknown;
};

const SIMILARITY_THRESHOLD = 0.82;

const prohibitedPatterns: readonly RegExp[] = [
  /\b(?:cure|cures|cured|diagnose|diagnosed|diagnosis)\b[\s\S]{0,80}\b(?:you|your|this|the)\b/i,
  /\b(?:medical|legal|financial)\s+(?:advice|treatment|diagnosis|guarantee)\b/i,
  /\b(?:curará|curaran|curarás|curar|cura|diagnóstico|diagnostico|tratamento médico|conselho jurídico|conseil juridique|medizinische Beratung|consiglio legale|гарант\w*|гарант\w*|gwarant\w*|wylecz\w*)\b/i,
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
  /\b(?:user[_ -]?id|account[_ -]?id|receipt|purchase[_ -]?token|raw[_ -]?(?:prayer|journal)|private (?:prayer|journal|note))\b/i,
];

const forbiddenScriptureKeys = new Set([
  'scripture_text',
  'scripture_body',
  'verse_text',
  'verse_body',
  'bible_text',
  'bible_body',
]);

export function validateGatheringCandidate(
  candidate: unknown,
  context: GatheringValidationContext = {},
): GatheringValidationResult {
  if (containsForbiddenScriptureKey(candidate)) return { ok: false, code: 'scripture_text_forbidden' };

  const structuralFailure = inspectStructure(candidate);
  if (structuralFailure) return structuralFailure;

  const parsed = generatedGatheringSchema.safeParse(candidate);
  if (!parsed.success) return classifySchemaFailure(candidate, parsed.error.issues);

  const prose = editorialProse(parsed.data);
  if (prohibitedPatterns.some((pattern) => pattern.test(prose))) {
    return { ok: false, code: 'prohibited_content' };
  }

  const priorReleases = getPriorReleases(context).slice(0, 12);
  const threshold = typeof context.similarityThreshold === 'number'
    && Number.isFinite(context.similarityThreshold)
    && context.similarityThreshold >= 0
    && context.similarityThreshold <= 1
    ? context.similarityThreshold
    : SIMILARITY_THRESHOLD;
  const candidateHash = candidateContentHash(parsed.data);
  if (priorReleases.some((prior) => releaseSimilarity(parsed.data, candidateHash, prior) > threshold)) {
    return { ok: false, code: 'similarity_too_high' };
  }

  return { ok: true };
}

export function candidateContentHash(candidate: unknown): string {
  const normalized = canonicalize(candidate);
  return createHash('sha256').update(JSON.stringify(normalized) ?? 'null', 'utf8').digest('hex');
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
  if (issues.some(({ path }) => path.includes('title') || path.includes('summary') || path.includes('body'))) {
    return { ok: false, code: 'bounded_field_invalid' };
  }
  if (isRecord(candidate) && typeof candidate.scripture_reference !== 'string') {
    return { ok: false, code: 'bounded_field_invalid' };
  }
  return { ok: false, code: 'schema_invalid' };
}

function editorialProse(candidate: GeneratedGathering): string {
  const localized = GATHERING_LOCALES.flatMap((locale) => {
    const content = candidate.locales[locale];
    return [content.title, content.summary, ...content.steps.map((step) => step.body)];
  });
  return localized.join('\n');
}

function getPriorReleases(context: GatheringValidationContext): readonly unknown[] {
  for (const key of ['recentReleases', 'last12Releases', 'priorReleases', 'recentContent'] as const) {
    if (Array.isArray(context[key])) return context[key];
  }
  return [];
}

function releaseSimilarity(candidate: GeneratedGathering, candidateHash: string, prior: unknown): number {
  if (typeof prior === 'string') {
    if (/^[0-9a-f]{64}$/.test(prior) && prior === candidateHash) return 1;
    return jaccardSimilarity(editorialProse(candidate), prior);
  }
  if (!isRecord(prior)) return 0;

  const parsedPrior = generatedGatheringSchema.safeParse(prior);
  if (parsedPrior.success) return jaccardSimilarity(editorialProse(candidate), editorialProse(parsedPrior.data));

  if (typeof prior.similarity === 'number' && Number.isFinite(prior.similarity)) {
    return prior.similarity;
  }

  for (const key of ['content_hash', 'contentHash', 'hash'] as const) {
    if (typeof prior[key] === 'string' && prior[key] === candidateHash) return 1;
  }
  for (const key of ['candidate', 'content', 'payload', 'draft'] as const) {
    if (prior[key] !== undefined) return releaseSimilarity(candidate, candidateHash, prior[key]);
  }
  return jaccardSimilarity(editorialProse(candidate), flattenStrings(prior));
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

function flattenStrings(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(flattenStrings).join('\n');
  if (isRecord(value)) return Object.values(value).map(flattenStrings).join('\n');
  return '';
}

function containsForbiddenScriptureKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenScriptureKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, entry]) => {
    return forbiddenScriptureKeys.has(key.toLowerCase()) || containsForbiddenScriptureKey(entry);
  });
}

function canonicalize(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.trim().replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ');
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
