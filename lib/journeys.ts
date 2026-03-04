import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { localizeJourneyBlocksWithAI } from '@/lib/aiLocalizer';

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

export type JourneyStepPayload = {
  stepOrder: number;
  stepType: string;
  blockId: string;
  blockSlug: string;
  title: string;
  body: string;
  scriptureRef: string | null;
  ctaText: string | null;
  tag: string;
  required: boolean;
};

function stableIndex(seed: string, size: number) {
  const hash = crypto.createHash('sha256').update(seed).digest();
  const value = hash.readUInt32BE(0);
  return value % size;
}

function chooseLocalization(localizations: BlockLocalization[], language: string) {
  return localizations.find((loc) => loc.language_code === language) ?? localizations.find((loc) => loc.language_code === 'en') ?? localizations[0] ?? null;
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

    if (!blockId || !stepType || !blockSlug || !title || !body || !Number.isFinite(stepOrderRaw)) {
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
  supabase: SupabaseClient,
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
        const localized = await localizeJourneyBlocksWithAI({
          requestId,
          targetLanguage: language,
          sourceLanguage: 'en',
          blocks: englishRows as Array<{
            block_id: string;
            title: string;
            body: string;
            scripture_ref: string | null;
            cta_text: string | null;
          }>,
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

async function fetchBlockCandidates(
  supabase: SupabaseClient,
  stepType: string,
  tag: string,
) {
  const baseSelect = 'id, slug, block_type, theme_tags, journey_block_localizations(language_code, title, body, scripture_ref, cta_text)';

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
  supabase: SupabaseClient,
  templateId: string,
  journeyId: string,
  dayNumber: number,
  language: string,
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
    const candidates = await fetchBlockCandidates(supabase, step.step_type, step.block_pool_tag);
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
      ctaText: localization.cta_text,
      tag: step.block_pool_tag,
      required: step.required,
    });
  }

  return resolvedSteps;
}

export async function getOrCreateDayAssignment(
  supabase: SupabaseClient,
  journeyId: string,
  templateId: string,
  dayNumber: number,
  language: string,
) {
  const { data: existingAssignment, error: existingError } = await supabase
    .from('user_journey_day_assignments')
    .select('steps')
    .eq('user_journey_id', journeyId)
    .eq('day_number', dayNumber)
    .single();

  if (!existingError && existingAssignment?.steps) {
    const existingSteps = normalizeStoredSteps(existingAssignment.steps);
    return localizeAssignedSteps(supabase, existingSteps, language);
  }

  const steps = await buildDaySteps(supabase, templateId, journeyId, dayNumber, language);
  const { error: insertError } = await supabase.from('user_journey_day_assignments').insert({
    user_journey_id: journeyId,
    day_number: dayNumber,
    steps,
  });

  if (insertError) {
    throw new Error('Could not create journey day assignment');
  }

  return localizeAssignedSteps(supabase, steps, language);
}
