import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

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
    return existingAssignment.steps as JourneyStepPayload[];
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

  return steps;
}
