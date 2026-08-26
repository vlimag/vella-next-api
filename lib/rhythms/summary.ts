import { createServiceClient } from '@/lib/supabase';
import { resolveRhythmsCapabilities, type RhythmsCapability } from '@/lib/rhythms/capabilities';
import {
  baseRhythmsSummary,
  finiteInteger,
  isPracticeCode,
  isStableSlug,
  type RhythmsSummary,
} from '@/lib/rhythms/contracts';

type QueryResult = { data: unknown; error: unknown };
type SummarySection = 'journeys' | 'practices' | 'gatherings' | 'milestones';

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

function applyJourneys(summary: RhythmsSummary, result: QueryResult): boolean {
  const rows = asRows(result.data);
  if (result.error || !rows) return false;

  const journeys = rows.flatMap((row) => {
    const template = joinedRecord(row.journey_templates);
    const templateKey = template?.slug;
    const currentSession = finiteInteger(row.current_day, 1, 1000);
    const completedSessions = finiteInteger(row.total_completed_days, 0, 1000);
    const status = row.status;
    if (!isStableSlug(templateKey) || currentSession === null || completedSessions === null) return [];
    if (status !== 'active' && status !== 'completed') return [];
    return [{ templateKey, currentSession, completedSessions, status }];
  });

  const active = journeys.find((journey) => journey.status === 'active');
  const completed = journeys.find((journey) => journey.status === 'completed');
  if (active) {
    summary.active_journey = {
      template_key: active.templateKey,
      current_session: active.currentSession,
      completed_sessions: active.completedSessions,
    };
    summary.next_action = { kind: 'continue_journey', target_key: active.templateKey };
  } else if (completed) {
    summary.latest_completed_journey = {
      template_key: completed.templateKey,
      completed_sessions: completed.completedSessions,
    };
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

function applyMilestones(summary: RhythmsSummary, result: QueryResult): boolean {
  const rows = asRows(result.data);
  if (result.error || !rows) return false;
  const milestones = rows.flatMap((row) => {
    const milestone = joinedRecord(row.gamification_milestones);
    if (!isStableSlug(milestone?.code) || !isStableSlug(milestone.asset_key)) return [];
    return [{ code: milestone.code, asset_key: milestone.asset_key }];
  });
  if (milestones.length > 0) summary.unrevealed_milestones = milestones;
  return true;
}

async function querySections(userId: string, capabilities: RhythmsCapability, summary: RhythmsSummary) {
  const supabase = createServiceClient();
  if (capabilities.journey_v2 || capabilities.long_journeys) {
    const result = await supabase
      .from('user_journeys')
      .select('status, current_day, total_completed_days, journey_templates!inner(slug)')
      .eq('user_id', userId) as QueryResult;
    if (!applyJourneys(summary, result)) {
      logSectionFailure('journeys', result.error);
      capabilities.journey_v2 = false;
      capabilities.long_journeys = false;
    }
  }
  if (capabilities.practices) {
    const result = await supabase
      .from('user_practices')
      .select('practice_code, weekly_target, status, practice_definitions!inner(code)')
      .eq('user_id', userId) as QueryResult;
    if (!applyPractices(summary, result)) {
      logSectionFailure('practices', result.error);
      capabilities.practices = false;
    }
  }
  if (capabilities.gatherings) {
    const result = await supabase
      .from('user_gathering_progress')
      .select('current_step, status, gathering_templates!inner(slug)')
      .eq('user_id', userId) as QueryResult;
    if (!applyGatherings(summary, result)) {
      logSectionFailure('gatherings', result.error);
      capabilities.gatherings = false;
    }
  }
  if (capabilities.social_badges) {
    const result = await supabase
      .from('user_milestones')
      .select('gamification_milestones!inner(code, asset_key)')
      .eq('user_id', userId) as QueryResult;
    if (!applyMilestones(summary, result)) {
      logSectionFailure('milestones', result.error);
      capabilities.social_badges = false;
    }
  }
}

export async function loadRhythmsSummary(userId: string, _locale: string): Promise<RhythmsSummary> {
  const capabilities = resolveRhythmsCapabilities();
  const summary = baseRhythmsSummary(capabilities);
  if (!Object.values(capabilities).some(Boolean)) return summary;

  try {
    await querySections(userId, capabilities, summary);
  } catch {
    // A client initialization failure has no safe section attribution; fail closed for enabled sections.
    const enabled = Object.keys(capabilities) as Array<keyof RhythmsCapability>;
    for (const key of enabled) capabilities[key] = false;
    console.error('[rhythms-summary]', {
      route: 'rhythms_summary', stage: 'summary', code: 'database_unavailable',
    });
    delete summary.active_journey;
    delete summary.latest_completed_journey;
    delete summary.practices;
    delete summary.current_gathering;
    delete summary.unrevealed_milestones;
    delete summary.next_action;
  }
  return summary;
}
