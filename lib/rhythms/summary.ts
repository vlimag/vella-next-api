import { createServiceClient } from '@/lib/supabase';
import { z } from 'zod';
import { resolveRhythmsCapabilities, type RhythmsCapability } from '@/lib/rhythms/capabilities';
import {
  baseRhythmsSummary,
  finiteInteger,
  isPracticeCode,
  isStableSlug,
  type RhythmsSummary,
} from '@/lib/rhythms/contracts';
import { recommendNextJourney } from '@/lib/rhythms/journeyRecommendations';

type QueryResult = { data: unknown; error: unknown };
type SummarySection = 'journeys' | 'practices' | 'gatherings' | 'milestones';
const uuidSchema = z.string().uuid();

function safeFailureCode(_error: unknown): 'database_unavailable' {
  return 'database_unavailable';
}

function logSectionFailure(stage: SummarySection, error: unknown) {
  console.error('[rhythms-summary]', {
    route: 'rhythms_summary',
    stage,
    code: safeFailureCode(error),
  });
}

function asRows(value: unknown): Record<string, unknown>[] | null {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : null;
}

function joinedRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value[0] && typeof value[0] === 'object' ? value[0] as Record<string, unknown> : null;
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function completedAt(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function validTimezone(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 && /^[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(value);
}

function applyJourneys(summary: RhythmsSummary, result: QueryResult, locale: string): boolean {
  const rows = asRows(result.data);
  if (result.error || !rows) return false;

  const journeys = rows.flatMap((row) => {
    const template = joinedRecord(row.journey_templates);
    const templateKey = template?.slug;
    const currentSession = finiteInteger(row.current_day, 1, 1000);
    const completedSessions = finiteInteger(row.total_completed_days, 0, 1000);
    const status = row.status;
    if (!isStableSlug(templateKey) || currentSession === null || completedSessions === null) return [];
    if (status !== 'active' && status !== 'paused' && status !== 'completed') return [];
    const completedTimestamp = status === 'completed' ? completedAt(row.completed_at) : null;
    if (status === 'completed' && completedTimestamp === null) return [];
    const pausedAt = status === 'paused' ? completedAt(row.paused_at) : null;
    const timezoneName = status === 'paused' && validTimezone(row.timezone_name) ? row.timezone_name : null;
    const journeyId = status === 'paused' && typeof row.id === 'string' && uuidSchema.safeParse(row.id).success
      ? row.id
      : null;
    if (status === 'paused' && (journeyId === null || pausedAt === null || timezoneName === null)) return [];
    return [{ journeyId, templateKey, currentSession, completedSessions, completedTimestamp, pausedAt, timezoneName, status }];
  });

  const active = journeys.find((journey) => journey.status === 'active');
  const completed = journeys
    .filter((journey) => journey.status === 'completed')
    .sort((left, right) => (
      right.completedTimestamp! - left.completedTimestamp!
      || left.templateKey.localeCompare(right.templateKey)
    ))[0];
  if (active) {
    summary.active_journey = {
      template_key: active.templateKey,
      current_session: active.currentSession,
      completed_sessions: active.completedSessions,
    };
    summary.next_action = { kind: 'continue_journey', target_key: active.templateKey };
  }
  if (completed) {
    summary.latest_completed_journey = {
      template_key: completed.templateKey,
      completed_sessions: completed.completedSessions,
    };
  }
  const paused = journeys
    .filter((journey) => journey.status === 'paused')
    .sort((left, right) => right.pausedAt! - left.pausedAt! || left.templateKey.localeCompare(right.templateKey))[0];
  if (paused) {
    summary.paused_journey = {
      journey_id: paused.journeyId!,
      template_key: paused.templateKey,
      current_session: paused.currentSession,
      completed_sessions: paused.completedSessions,
      paused_at: new Date(paused.pausedAt!).toISOString(),
      timezone_name: paused.timezoneName!,
    };
  }
  if (!active && journeys.length > 0) {
    const recommendation = recommendNextJourney({
      completed: journeys.filter((journey) => journey.status === 'completed').map((journey) => journey.templateKey),
      goals: [],
      locale,
    });
    if (recommendation) summary.next_journey_recommendation = recommendation;
  }
  if (!active && completed) {
    summary.next_action = { kind: 'choose_journey', target_key: 'journeys' };
  }
  return true;
}

function applyPractices(summary: RhythmsSummary, result: QueryResult): boolean {
  const rows = asRows(result.data);
  if (result.error || !rows) return false;
  const practices = rows.flatMap((row) => {
    const definition = joinedRecord(row.practice_definitions);
    const weeklyTarget = finiteInteger(row.weekly_target, 1, 7);
    if (
      !isPracticeCode(row.practice_code)
      || definition?.code !== row.practice_code
      || weeklyTarget === null
      || (row.status !== 'active' && row.status !== 'paused')
    ) return [];
    return [{
      code: row.practice_code,
      weekly_target: weeklyTarget,
      status: row.status as 'active' | 'paused',
    }];
  });
  if (practices.length > 0) summary.practices = practices;
  return true;
}

function applyGatherings(summary: RhythmsSummary, result: QueryResult): boolean {
  const rows = asRows(result.data);
  if (result.error || !rows) return false;
  const current = rows.flatMap((row) => {
    const template = joinedRecord(row.gathering_templates);
    const currentStep = finiteInteger(row.current_step, 0, 32);
    if (
      !isStableSlug(template?.slug)
      || currentStep === null
      || !['not_started', 'in_progress', 'completed', 'abandoned'].includes(String(row.status))
    ) return [];
    return [{ template_key: template.slug, current_step: currentStep, status: row.status as 'not_started' | 'in_progress' | 'completed' | 'abandoned' }];
  }).find((row) => row.status === 'in_progress');
  if (current) summary.current_gathering = current;
  return true;
}

function probeSection(result: QueryResult): boolean {
  const rows = asRows(result.data);
  return !result.error && rows !== null;
}

async function querySections(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  capabilities: RhythmsCapability,
  summary: RhythmsSummary,
  locale: string,
) {
  if (capabilities.journey_v2 || capabilities.long_journeys) {
    let available = false;
    try {
      const result = await supabase
        .from('user_journeys')
        .select('id, status, current_day, total_completed_days, completed_at, paused_at, timezone_name, journey_templates!inner(slug)')
        .eq('user_id', userId) as QueryResult;
      available = applyJourneys(summary, result, locale);
      if (!available) logSectionFailure('journeys', result.error);
    } catch (error) {
      logSectionFailure('journeys', error);
    }
    if (!available) {
      capabilities.journey_v2 = false;
      capabilities.long_journeys = false;
    }
  }
  if (capabilities.practices) {
    let available = false;
    try {
      const result = await supabase
        .from('user_practices')
        .select('practice_code, weekly_target, status, practice_definitions!inner(code)')
        .eq('user_id', userId) as QueryResult;
      available = applyPractices(summary, result);
      if (!available) logSectionFailure('practices', result.error);
    } catch (error) {
      logSectionFailure('practices', error);
    }
    if (!available) capabilities.practices = false;
  }
  if (capabilities.gatherings) {
    let available = false;
    try {
      const result = await supabase
        .from('user_gathering_progress')
        .select('current_step, status, gathering_templates!inner(slug)')
        .eq('user_id', userId) as QueryResult;
      available = applyGatherings(summary, result);
      if (!available) logSectionFailure('gatherings', result.error);
    } catch (error) {
      logSectionFailure('gatherings', error);
    }
    if (!available) capabilities.gatherings = false;
  }
  if (capabilities.social_badges) {
    let available = false;
    try {
      const result = await supabase
        .from('user_featured_milestones')
        .select('position')
        .eq('user_id', userId) as QueryResult;
      available = probeSection(result);
      if (!available) logSectionFailure('milestones', result.error);
    } catch (error) {
      logSectionFailure('milestones', error);
    }
    if (!available) capabilities.social_badges = false;
  }
}

function disableAll(capabilities: RhythmsCapability, summary: RhythmsSummary) {
  const enabled = Object.keys(capabilities) as Array<keyof RhythmsCapability>;
  for (const key of enabled) capabilities[key] = false;
  delete summary.active_journey;
  delete summary.latest_completed_journey;
  delete summary.paused_journey;
  delete summary.next_journey_recommendation;
  delete summary.practices;
  delete summary.current_gathering;
  delete summary.next_action;
}

export async function loadRhythmsSummary(userId: string, locale: string): Promise<RhythmsSummary> {
  const capabilities = resolveRhythmsCapabilities();
  const summary = baseRhythmsSummary(capabilities);
  if (!Object.values(capabilities).some(Boolean)) return summary;

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch {
    disableAll(capabilities, summary);
    console.error('[rhythms-summary]', {
      route: 'rhythms_summary', stage: 'summary', code: 'database_unavailable',
    });
    return summary;
  }

  await querySections(supabase, userId, capabilities, summary, locale);
  return summary;
}
