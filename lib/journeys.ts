import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { localizeJourneyBlocksWithAI } from '@/lib/aiLocalizer';

type AppSupabaseClient = SupabaseClient<any, any, any, any, any>;

type TemplateStep = {
  step_order: number;
  step_type: string;
  block_pool_tag: string;
  required: boolean;
};

type BlockLocalization = {
  language_code: string;
  title: string;
  body: string;
  scripture_ref: string | null;
  cta_text: string | null;
};

type BlockCandidate = {
  id: string;
  slug: string;
  block_type: string;
  theme_tags: string[];
  journey_block_localizations: BlockLocalization[];
};

type StoredStep = {
  stepOrder?: number;
  step_order?: number;
  stepType?: string;
  step_type?: string;
  blockId?: string;
  block_id?: string;
  blockSlug?: string;
  block_slug?: string;
  title?: string;
  body?: string;
  scriptureRef?: string | null;
  scripture_ref?: string | null;
  ctaText?: string | null;
  cta_text?: string | null;
  tag?: string;
  required?: boolean;
};

type LocalizationRow = {
  block_id: string;
  language_code: string;
  title: string;
  body: string;
  scripture_ref: string | null;
  cta_text: string | null;
};

type CanonicalScriptureReference = {
  bookCode: string;
  chapter: number;
  verse: number;
};

export type ApprovedJourneyScripture = {
  verseId: string;
  bookCode: string;
  chapter: number;
  verse: number;
  text: string;
  languageCode: string;
  versionCode: string;
  versionName: string;
};

export type JourneyStepPayload = {
  stepOrder: number;
  stepType: string;
  blockId: string;
  blockSlug: string;
  title: string;
  body: string;
  scriptureRef: string | null;
  scriptureVerseId: string | null;
  scriptureVersionCode: string | null;
  scriptureVersionName: string | null;
  scriptureLanguageCode: string | null;
  ctaText: string | null;
  tag: string;
  required: boolean;
};

const ENGLISH_BOOK_CODES: Record<string, string> = {
  john: 'JHN',
  jhn: 'JHN',
  jeremiah: 'JER',
  jer: 'JER',
  psalm: 'PSA',
  psalms: 'PSA',
  psa: 'PSA',
  ps: 'PSA',
};

function stableIndex(seed: string, size: number) {
  const hash = crypto.createHash('sha256').update(seed).digest();
  const value = hash.readUInt32BE(0);
  return value % size;
}

function chooseLocalization(localizations: BlockLocalization[], language: string) {
  return localizations.find((loc) => loc.language_code === language) ?? localizations.find((loc) => loc.language_code === 'en') ?? localizations[0] ?? null;
}

function firstRelation(value: unknown): Record<string, unknown> | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === 'object' ? (relation as Record<string, unknown>) : null;
}

export function parseJourneyScriptureReference(value: string | null): CanonicalScriptureReference | null {
  if (!value) return null;
  const match = value.trim().match(/^(.+?)\s+(\d{1,3})\s*:\s*(\d{1,3})$/i);
  if (!match) return null;

  const bookCode = ENGLISH_BOOK_CODES[match[1].trim().toLowerCase().replace(/\.$/, '')];
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  if (!bookCode || !Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1) {
    return null;
  }

  return { bookCode, chapter, verse };
}

export function selectApprovedJourneyScripture(
  rows: unknown,
  language: string,
  reference: CanonicalScriptureReference,
): ApprovedJourneyScripture | null {
  if (!Array.isArray(rows)) return null;
  const requestedLanguage = language.toLowerCase();
  const candidates: ApprovedJourneyScripture[] = [];

  for (const input of rows) {
    if (!input || typeof input !== 'object') continue;
    const row = input as Record<string, unknown>;
    const book = firstRelation(row.bible_books);
    const version = firstRelation(row.bible_versions);
    const chapter = Number(row.chapter);
    const verse = Number(row.verse);
    const languageCode = typeof row.language_code === 'string' ? row.language_code.toLowerCase() : '';
    const text = typeof row.text_content === 'string' ? row.text_content.trim() : '';
    const versionCode = typeof version?.code === 'string' ? version.code.trim() : '';
    const versionName = typeof version?.name === 'string' ? version.name.trim() : '';

    if (
      typeof row.id !== 'string' ||
      book?.code !== reference.bookCode ||
      chapter !== reference.chapter ||
      verse !== reference.verse ||
      (languageCode !== requestedLanguage && languageCode !== 'en') ||
      text.length === 0 ||
      versionCode.length === 0 ||
      versionName.length === 0 ||
      version?.is_active !== true
    ) {
      continue;
    }

    candidates.push({
      verseId: row.id,
      bookCode: reference.bookCode,
      chapter,
      verse,
      text,
      languageCode,
      versionCode,
      versionName,
    });
  }

  candidates.sort((left, right) => {
    const languageDifference = Number(right.languageCode === requestedLanguage) - Number(left.languageCode === requestedLanguage);
    if (languageDifference !== 0) return languageDifference;
    return `${left.versionCode}:${left.verseId}`.localeCompare(`${right.versionCode}:${right.verseId}`);
  });
  return candidates[0] ?? null;
}

export function applyApprovedJourneyScripture(
  step: JourneyStepPayload,
  scripture: ApprovedJourneyScripture | null,
): JourneyStepPayload {
  if (step.stepType !== 'verse') return step;
  if (!scripture) {
    return {
      ...step,
      body: '',
      scriptureRef: null,
      scriptureVerseId: null,
      scriptureVersionCode: null,
      scriptureVersionName: null,
      scriptureLanguageCode: null,
      ctaText: null,
    };
  }

  return {
    ...step,
    body: scripture.text,
    scriptureRef: `${scripture.bookCode} ${scripture.chapter}:${scripture.verse}`,
    scriptureVerseId: scripture.verseId,
    scriptureVersionCode: scripture.versionCode,
    scriptureVersionName: scripture.versionName,
    scriptureLanguageCode: scripture.languageCode,
  };
}

function normalizeStoredSteps(raw: unknown): JourneyStepPayload[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const steps: JourneyStepPayload[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const step = item as StoredStep;
    const blockId = typeof step.blockId === 'string' ? step.blockId : typeof step.block_id === 'string' ? step.block_id : '';
    const stepType = typeof step.stepType === 'string' ? step.stepType : typeof step.step_type === 'string' ? step.step_type : '';
    const blockSlug = typeof step.blockSlug === 'string' ? step.blockSlug : typeof step.block_slug === 'string' ? step.block_slug : '';
    const title = typeof step.title === 'string' ? step.title : '';
    const body = typeof step.body === 'string' ? step.body : '';
    const stepOrderRaw = typeof step.stepOrder === 'number' ? step.stepOrder : typeof step.step_order === 'number' ? step.step_order : 0;

    if (!blockId || !stepType || !blockSlug || !title || (!body && stepType !== 'verse') || !Number.isFinite(stepOrderRaw)) {
      continue;
    }

    steps.push({
      stepOrder: Number(stepOrderRaw),
      stepType,
      blockId,
      blockSlug,
      title,
      body,
      scriptureRef:
        step.scriptureRef === null || typeof step.scriptureRef === 'string'
          ? step.scriptureRef
          : step.scripture_ref === null || typeof step.scripture_ref === 'string'
            ? step.scripture_ref
            : null,
      scriptureVerseId: null,
      scriptureVersionCode: null,
      scriptureVersionName: null,
      scriptureLanguageCode: null,
      ctaText:
        step.ctaText === null || typeof step.ctaText === 'string'
          ? step.ctaText
          : step.cta_text === null || typeof step.cta_text === 'string'
            ? step.cta_text
            : null,
      tag: typeof step.tag === 'string' ? step.tag : '',
      required: Boolean(step.required),
    });
  }

  return steps;
}

async function localizeAssignedSteps(
  supabase: AppSupabaseClient,
  steps: JourneyStepPayload[],
  language: string,
) {
  if (steps.length === 0) {
    return steps;
  }

  const blockIds = [...new Set(steps.map((step) => step.blockId).filter(Boolean))];
  if (blockIds.length === 0) {
    return steps;
  }

  const { data, error } = await supabase
    .from('journey_block_localizations')
    .select('block_id, language_code, title, body, scripture_ref, cta_text')
    .in('block_id', blockIds)
    .in('language_code', [...new Set([language, 'en'])]);

  if (error || !data) {
    return steps;
  }

  const byBlock = new Map<string, { preferred?: LocalizationRow; fallback?: LocalizationRow }>();
  for (const row of data as LocalizationRow[]) {
    const bucket = byBlock.get(row.block_id) ?? {};
    if (row.language_code === language) {
      bucket.preferred = row;
    } else if (row.language_code === 'en') {
      bucket.fallback = row;
    }
    byBlock.set(row.block_id, bucket);
  }

  const missingBlockIds = blockIds.filter((id) => !byBlock.get(id)?.preferred);
  if (missingBlockIds.length > 0 && language !== 'en') {
    const { data: englishRows, error: englishRowsError } = await supabase
      .from('journey_block_localizations')
      .select('block_id, title, body, scripture_ref, cta_text')
      .in('block_id', missingBlockIds)
      .eq('language_code', 'en');

    if (!englishRowsError && englishRows && englishRows.length > 0) {
      try {
        const requestId = `journey_blocks_${language}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const verseBlockIds = new Set(steps.filter((step) => step.stepType === 'verse').map((step) => step.blockId));
        const localized = await localizeJourneyBlocksWithAI({
          requestId,
          targetLanguage: language,
          sourceLanguage: 'en',
          blocks: (englishRows as LocalizationRow[]).map((row) => ({
            ...row,
            is_scripture: verseBlockIds.has(row.block_id),
          })),
        });

        if (localized.length > 0) {
          const upsertRows = localized.map((row) => ({
            block_id: row.block_id,
            language_code: language,
            title: row.title,
            body: row.body,
            scripture_ref: row.scripture_ref,
            cta_text: row.cta_text,
          }));

          // Serve localized text immediately even if DB cache write fails.
          for (const row of upsertRows) {
            const bucket = byBlock.get(row.block_id) ?? {};
            bucket.preferred = {
              block_id: row.block_id,
              language_code: language,
              title: row.title,
              body: row.body,
              scripture_ref: row.scripture_ref,
              cta_text: row.cta_text,
            };
            byBlock.set(row.block_id, bucket);
          }

          const { error: upsertError } = await supabase
            .from('journey_block_localizations')
            .upsert(upsertRows, { onConflict: 'block_id,language_code' });

          if (!upsertError) {
            console.info('[journey-localizer] blocks_cached', {
              requestId,
              language,
              count: upsertRows.length,
            });
          } else {
            console.warn('[journey-localizer] blocks_cache_write_failed', {
              requestId,
              language,
              error: upsertError.message,
            });
          }
        }
      } catch (error) {
        console.error('[journey-localizer] blocks_localization_failed', {
          language,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return steps.map((step) => {
    const localized = byBlock.get(step.blockId)?.preferred ?? byBlock.get(step.blockId)?.fallback;
    if (!localized) {
      return step;
    }

    return {
      ...step,
      title: localized.title,
      body: localized.body,
      scriptureRef: localized.scripture_ref,
      ctaText: localized.cta_text,
    };
  });
}

async function hydrateJourneyScripture(
  supabase: AppSupabaseClient,
  steps: JourneyStepPayload[],
  language: string,
) {
  const verseSteps = steps.filter((step) => step.stepType === 'verse');
  if (verseSteps.length === 0) return steps;

  const safeSteps = steps.map((step) => applyApprovedJourneyScripture(step, null));
  const blockIds = [...new Set(verseSteps.map((step) => step.blockId))];
  const { data: referenceRows, error: referenceError } = await supabase
    .from('journey_block_localizations')
    .select('block_id, scripture_ref')
    .in('block_id', blockIds)
    .eq('language_code', 'en');

  if (referenceError || !referenceRows) {
    console.warn('[journeys] scripture_reference_lookup_failed', {
      error: referenceError?.message ?? 'No canonical references returned',
    });
    return safeSteps;
  }

  const referencesByBlock = new Map<string, CanonicalScriptureReference>();
  for (const row of referenceRows as Array<{ block_id: string; scripture_ref: string | null }>) {
    const parsed = parseJourneyScriptureReference(row.scripture_ref);
    if (parsed) referencesByBlock.set(row.block_id, parsed);
  }

  const approvedByReference = new Map<string, ApprovedJourneyScripture | null>();
  for (const reference of referencesByBlock.values()) {
    const key = `${reference.bookCode}:${reference.chapter}:${reference.verse}`;
    if (approvedByReference.has(key)) continue;

    const languages = [...new Set([language.toLowerCase(), 'en'])];
    const { data, error } = await supabase
      .from('bible_verses')
      .select(
        'id, chapter, verse, text_content, language_code, bible_books!inner(code), bible_versions!inner(code, name, is_active)',
      )
      .eq('bible_books.code', reference.bookCode)
      .eq('chapter', reference.chapter)
      .eq('verse', reference.verse)
      .eq('bible_versions.is_active', true)
      .in('language_code', languages);

    if (error) {
      console.warn('[journeys] scripture_corpus_lookup_failed', { reference: key, error: error.message });
      approvedByReference.set(key, null);
      continue;
    }
    approvedByReference.set(key, selectApprovedJourneyScripture(data, language, reference));
  }

  const hydratedSteps = safeSteps.map((step) => {
    const reference = referencesByBlock.get(step.blockId);
    if (!reference) return step;
    const key = `${reference.bookCode}:${reference.chapter}:${reference.verse}`;
    return applyApprovedJourneyScripture(step, approvedByReference.get(key) ?? null);
  });

  // A blank "verse" card is neither useful nor trustworthy. When the approved
  // corpus does not contain that reference, omit the step until an edition is
  // imported; the remaining reflection, prayer, and action steps still form a
  // complete session.
  return hydratedSteps.filter(
    (step) => step.stepType !== 'verse' || Boolean(step.scriptureVerseId && step.body && step.scriptureRef),
  );
}

async function prepareAssignedSteps(
  supabase: AppSupabaseClient,
  steps: JourneyStepPayload[],
  language: string,
) {
  const localized = await localizeAssignedSteps(supabase, steps, language);
  return hydrateJourneyScripture(supabase, localized, language);
}

async function fetchBlockCandidates(
  supabase: AppSupabaseClient,
  stepType: string,
  tag: string,
  preferredTag?: string | null,
) {
  const baseSelect = 'id, slug, block_type, theme_tags, journey_block_localizations(language_code, title, body, scripture_ref, cta_text)';

  if (preferredTag) {
    const preferred = await supabase
      .from('journey_blocks')
      .select(baseSelect)
      .eq('block_type', stepType)
      .eq('is_active', true)
      .contains('theme_tags', [preferredTag]);

    if (!preferred.error && preferred.data && preferred.data.length > 0) {
      return preferred.data as BlockCandidate[];
    }
  }

  const tagged = await supabase
    .from('journey_blocks')
    .select(baseSelect)
    .eq('block_type', stepType)
    .eq('is_active', true)
    .contains('theme_tags', [tag]);

  if (!tagged.error && tagged.data && tagged.data.length > 0) {
    return tagged.data as BlockCandidate[];
  }

  const fallback = await supabase
    .from('journey_blocks')
    .select(baseSelect)
    .eq('block_type', stepType)
    .eq('is_active', true);

  if (fallback.error || !fallback.data) {
    return [];
  }

  return fallback.data as BlockCandidate[];
}

async function buildDaySteps(
  supabase: AppSupabaseClient,
  templateId: string,
  journeyId: string,
  dayNumber: number,
  language: string,
  preferredTag?: string | null,
) {
  const { data: templateSteps, error: templateStepsError } = await supabase
    .from('journey_template_steps')
    .select('step_order, step_type, block_pool_tag, required')
    .eq('template_id', templateId)
    .eq('day_number', dayNumber)
    .order('step_order', { ascending: true });

  if (templateStepsError || !templateSteps) {
    throw new Error('Could not load journey template steps');
  }

  const resolvedSteps: JourneyStepPayload[] = [];

  for (const step of templateSteps as TemplateStep[]) {
    const candidates = await fetchBlockCandidates(supabase, step.step_type, step.block_pool_tag, preferredTag);
    if (candidates.length === 0) {
      continue;
    }

    const idx = stableIndex(`${journeyId}:${dayNumber}:${step.step_order}:${step.block_pool_tag}`, candidates.length);
    const block = candidates[idx];
    const localization = chooseLocalization(block.journey_block_localizations ?? [], language);
    if (!localization) {
      continue;
    }

    resolvedSteps.push({
      stepOrder: step.step_order,
      stepType: step.step_type,
      blockId: block.id,
      blockSlug: block.slug,
      title: localization.title,
      body: localization.body,
      scriptureRef: localization.scripture_ref,
      scriptureVerseId: null,
      scriptureVersionCode: null,
      scriptureVersionName: null,
      scriptureLanguageCode: null,
      ctaText: localization.cta_text,
      tag: step.block_pool_tag,
      required: step.required,
    });
  }

  return resolvedSteps;
}

export async function getOrCreateDayAssignment(
  supabase: AppSupabaseClient,
  journeyId: string,
  templateId: string,
  dayNumber: number,
  language: string,
  preferredTag?: string | null,
) {
  const { data: existingAssignment, error: existingError } = await supabase
    .from('user_journey_day_assignments')
    .select('id, steps')
    .eq('user_journey_id', journeyId)
    .eq('day_number', dayNumber)
    .single();

  if (!existingError && existingAssignment?.steps) {
    const existingSteps = normalizeStoredSteps(existingAssignment.steps);
    const safeSteps = await prepareAssignedSteps(supabase, existingSteps, language);
    const { error: sanitizeError } = await supabase
      .from('user_journey_day_assignments')
      .update({ steps: safeSteps })
      .eq('id', existingAssignment.id);
    if (sanitizeError) {
      console.warn('[journeys] assignment_sanitize_write_failed', { assignmentId: existingAssignment.id });
    }
    return safeSteps;
  }

  const builtSteps = await buildDaySteps(supabase, templateId, journeyId, dayNumber, language, preferredTag);
  const steps = await prepareAssignedSteps(supabase, builtSteps, language);
  const { error: insertError } = await supabase.from('user_journey_day_assignments').insert({
    user_journey_id: journeyId,
    day_number: dayNumber,
    steps,
  });

  if (insertError) {
    throw new Error('Could not create journey day assignment');
  }

  return steps;
}
