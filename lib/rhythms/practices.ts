import { z } from 'zod';
import { PRACTICE_CODES } from '@/lib/rhythms/contracts';

const practiceCodeSchema = z.enum(PRACTICE_CODES);
const selectedPracticeSchema = z.object({
  code: practiceCodeSchema,
  weekly_target: z.number().int().min(1).max(7),
}).strict();

export const practiceConfigurationInputSchema = z.object({
  timezone_name: z.string().min(1).max(255),
  practices: z.array(selectedPracticeSchema).min(2).max(4),
}).strict().superRefine((value, context) => {
  if (new Set(value.practices.map((practice) => practice.code)).size !== value.practices.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['practices'],
      message: 'Practice codes must be unique',
    });
  }
});

const catalogRowSchema = z.object({
  code: practiceCodeSchema,
  asset_key: z.string().regex(/^[a-z][a-z0-9_]{0,127}$/),
  session_kind: practiceCodeSchema,
  recommended_weekly_target: z.number().int().min(1).max(7),
  is_active: z.literal(true),
  version: z.number().int().min(1).max(1000),
});

const selectedRowSchema = z.object({
  practice_code: practiceCodeSchema,
  weekly_target: z.number().int().min(1).max(7),
  timezone_name: z.string().min(1).max(255),
  status: z.enum(['active', 'paused']),
});

type QueryResult = { data: unknown; error: unknown };
type QueryBuilder = PromiseLike<QueryResult> & {
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  in(column: string, values: readonly unknown[]): QueryBuilder;
  order(column: string): QueryBuilder;
};

export type PracticeClient = {
  from(table: string): QueryBuilder;
  rpc(name: string, params: Record<string, unknown>): PromiseLike<QueryResult>;
};

export type PracticeConfigurationInput = z.infer<typeof practiceConfigurationInputSchema>;

export function canonicalTimeZone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 255 || value !== value.trim()) return null;
  if (/^[+-]\d{2}:\d{2}$/.test(value)) return null;

  try {
    const resolved = new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
    return resolved === value ? resolved : null;
  } catch {
    return null;
  }
}

function uniqueByCode<T extends { code: string }>(rows: T[]): boolean {
  return new Set(rows.map((row) => row.code)).size === rows.length;
}

function finiteSelected(rows: unknown) {
  const parsed = z.array(selectedRowSchema).max(4).safeParse(rows);
  if (!parsed.success) return null;
  const selected = parsed.data.map((row) => ({
    code: row.practice_code,
    weekly_target: row.weekly_target,
    status: row.status,
  })).sort((left, right) => left.code.localeCompare(right.code));
  return uniqueByCode(selected) ? selected : null;
}

export async function loadPracticeConfiguration(client: PracticeClient, userId: string) {
  const [catalogResult, selectedResult] = await Promise.all([
    client.from('practice_definitions')
      .select('code,asset_key,session_kind,recommended_weekly_target,is_active,version')
      .eq('is_active', true)
      .order('code'),
    client.from('user_practices')
      .select('practice_code,weekly_target,timezone_name,status')
      .eq('user_id', userId)
      .order('practice_code'),
  ]);

  if (catalogResult.error || selectedResult.error) throw new Error('database_unavailable');
  const catalogParsed = z.array(catalogRowSchema).max(PRACTICE_CODES.length).safeParse(catalogResult.data);
  const selected = finiteSelected(selectedResult.data);
  if (!catalogParsed.success || !selected) throw new Error('invalid_response');

  const catalog = catalogParsed.data
    .map(({ is_active: _isActive, ...row }) => row)
    .sort((left, right) => left.code.localeCompare(right.code));
  if (!uniqueByCode(catalog)) throw new Error('invalid_response');

  const rawSelected = z.array(selectedRowSchema).safeParse(selectedResult.data);
  if (!rawSelected.success) throw new Error('invalid_response');
  const timezones = [...new Set(rawSelected.data.map((row) => row.timezone_name))];
  const timezone = timezones.length === 0 ? 'UTC' : canonicalTimeZone(timezones[0]);
  if (!timezone || timezones.length > 1) throw new Error('invalid_response');

  return {
    schema_version: 1 as const,
    timezone_name: timezone,
    catalog,
    selected,
  };
}

export type ReplacePracticeResult =
  | { ok: true; value: { schema_version: 1; timezone_name: string; selected: NonNullable<ReturnType<typeof finiteSelected>> } }
  | { ok: false; code: 'inactive_practice' | 'database_unavailable' | 'invalid_response' };

export async function replacePracticeConfiguration(
  client: PracticeClient,
  userId: string,
  input: PracticeConfigurationInput,
): Promise<ReplacePracticeResult> {
  const codes = input.practices.map((practice) => practice.code);
  const catalogResult = await client.from('practice_definitions')
    .select('code,asset_key,session_kind,recommended_weekly_target,is_active,version')
    .in('code', codes);

  if (catalogResult.error) return { ok: false, code: 'database_unavailable' };
  const catalogRows = z.array(catalogRowSchema).safeParse(catalogResult.data);
  if (!catalogRows.success) {
    return { ok: false, code: 'inactive_practice' };
  }
  const requestedRows = catalogRows.data.filter((row) => codes.includes(row.code));
  if (
    requestedRows.length !== codes.length
    || new Set(requestedRows.map((row) => row.code)).size !== codes.length
  ) {
    return { ok: false, code: 'inactive_practice' };
  }

  const result = await client.rpc('replace_user_practices', {
    p_owner_user_id: userId,
    p_timezone_name: input.timezone_name,
    p_practices: input.practices,
  });
  if (result.error) return { ok: false, code: 'database_unavailable' };
  const selected = finiteSelected(result.data);
  if (!selected || selected.length !== input.practices.length) return { ok: false, code: 'invalid_response' };

  return {
    ok: true,
    value: {
      schema_version: 1,
      timezone_name: input.timezone_name,
      selected,
    },
  };
}
