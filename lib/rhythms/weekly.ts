import { z } from 'zod';
import { PRACTICE_CODES } from '@/lib/rhythms/contracts';
import { canonicalTimeZone } from '@/lib/rhythms/practices';
import { localWeekStart } from '@/lib/rhythms/time';

const practiceCodeSchema = z.enum(PRACTICE_CODES);
const selectedRowSchema = z.object({
  practice_code: practiceCodeSchema,
  weekly_target: z.number().int().min(1).max(7),
  timezone_name: z.string().min(1).max(255),
  status: z.literal('active'),
});
const sessionRowSchema = z.object({
  practice_code: practiceCodeSchema,
  source_type: z.enum(['direct', 'journey', 'gathering']),
  status: z.enum(['started', 'completed', 'cancelled']),
});

type QueryResult = { data: unknown; error: unknown };
type QueryBuilder = PromiseLike<QueryResult> & {
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  order(column: string): QueryBuilder;
};

export type WeeklyClient = { from(table: string): QueryBuilder };

export function parseWeekStart(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date.getUTCDay() === 1 ? value : null;
}

export async function loadWeeklySummary(
  client: WeeklyClient,
  userId: string,
  requestedWeek?: string,
  now = new Date(),
) {
  const selectedResult = await client.from('user_practices')
    .select('practice_code,weekly_target,timezone_name,status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('practice_code');
  if (selectedResult.error) throw new Error('database_unavailable');

  const parsedSelected = z.array(selectedRowSchema).min(0).max(4).safeParse(selectedResult.data);
  if (!parsedSelected.success) throw new Error('invalid_response');
  if (new Set(parsedSelected.data.map((row) => row.practice_code)).size !== parsedSelected.data.length) {
    throw new Error('invalid_response');
  }

  if (parsedSelected.data.length === 0) {
    return {
      schema_version: 1 as const,
      week_start: requestedWeek ?? localWeekStart(now, 'UTC'),
      timezone_name: 'UTC',
      configured: false,
      practices: [],
      rhythm_met: false,
    };
  }

  const timezones = [...new Set(parsedSelected.data.map((row) => row.timezone_name))];
  const timezone = timezones.length === 1 ? canonicalTimeZone(timezones[0]) : null;
  if (!timezone) throw new Error('invalid_response');
  const weekStart = requestedWeek ?? localWeekStart(now, timezone);

  const sessionResult = await client.from('practice_sessions')
    .select('practice_code,source_type,status')
    .eq('user_id', userId)
    .eq('local_week_start', weekStart)
    .eq('status', 'completed');
  if (sessionResult.error) throw new Error('database_unavailable');
  const parsedSessions = z.array(sessionRowSchema).safeParse(sessionResult.data);
  if (!parsedSessions.success) throw new Error('invalid_response');

  const counts = new Map<string, number>();
  for (const session of parsedSessions.data) {
    if (session.status !== 'completed') continue;
    counts.set(session.practice_code, (counts.get(session.practice_code) ?? 0) + 1);
  }
  const practices = parsedSelected.data
    .map((row) => {
      const completed = counts.get(row.practice_code) ?? 0;
      return {
        code: row.practice_code,
        weekly_target: row.weekly_target,
        completed_sessions: completed,
        target_met: completed >= row.weekly_target,
      };
    })
    .sort((left, right) => left.code.localeCompare(right.code));

  return {
    schema_version: 1 as const,
    week_start: weekStart,
    timezone_name: timezone,
    configured: true,
    practices,
    rhythm_met: practices.every((practice) => practice.target_met),
  };
}
