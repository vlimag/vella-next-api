import type { RhythmsCapability } from '@/lib/rhythms/capabilities';

export type RhythmsSummary = {
  schema_version: 1;
  capabilities: RhythmsCapability;
  active_journey?: {
    template_key: string;
    current_session: number;
    completed_sessions: number;
  };
  latest_completed_journey?: {
    template_key: string;
    completed_sessions: number;
  };
  paused_journey?: {
    journey_id: string;
    template_key: string;
    current_session: number;
    completed_sessions: number;
    paused_at: string;
    timezone_name: string;
  };
  next_journey_recommendation?: {
    template_slug: string;
    reason_code: 'onboarding_goal_match' | 'next_available';
  };
  practices?: Array<{
    code: string;
    weekly_target: number;
    status: 'active' | 'paused';
  }>;
  current_gathering?: {
    template_key: string;
    current_step: number;
    status: 'not_started' | 'in_progress' | 'completed' | 'abandoned';
  };
  unrevealed_milestones?: Array<{
    code: string;
    asset_key: string;
  }>;
  next_action?: {
    kind: 'continue_journey' | 'choose_journey';
    target_key: string;
  };
};

export const PRACTICE_CODES = [
  'guided_prayer',
  'scripture',
  'gratitude',
  'silence',
  'daily_reflection',
  'act_of_kindness',
] as const;

const stableKey = /^[a-z][a-z0-9_-]{0,127}$/;
const stableSlug = /^[a-z][a-z0-9-]{0,127}$/;
const milestoneCode = /^[a-z][a-z0-9_]{0,63}$/;
const badgeAssetKey = /^[a-z][a-z0-9_.-]{0,127}$/;
const uuidSyntax = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isNonUuidString(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && !uuidSyntax.test(value) && pattern.test(value);
}

export function isPracticeCode(value: unknown): value is typeof PRACTICE_CODES[number] {
  return typeof value === 'string' && PRACTICE_CODES.includes(value as typeof PRACTICE_CODES[number]);
}

export function isStableKey(value: unknown): value is string {
  return isNonUuidString(value, stableKey);
}

export function isStableSlug(value: unknown): value is string {
  return isNonUuidString(value, stableSlug);
}

export function isMilestoneCode(value: unknown): value is string {
  return isNonUuidString(value, milestoneCode);
}

export function isBadgeAssetKey(value: unknown): value is string {
  return isNonUuidString(value, badgeAssetKey);
}

export function finiteInteger(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

export function baseRhythmsSummary(capabilities: RhythmsCapability): RhythmsSummary {
  return { schema_version: 1, capabilities };
}
