import { z } from 'zod';

const codeSchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const uuidSchema = z.string().uuid();
const assetSchema = z.string().regex(/^[a-z][a-z0-9_.-]{0,127}$/).nullable();

const catalogSchema = z.object({
  code: codeSchema,
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(800).optional(),
  category: z.enum(['journey', 'rhythm', 'practice', 'gathering', 'return']).optional(),
  tier: codeSchema.nullable(),
  theme_key: codeSchema.nullable(),
  asset_key: assetSchema,
  display_priority: z.number().int().min(0).max(10_000).optional(),
  is_shareable: z.boolean(),
  is_active: z.boolean(),
});

const earnedSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  milestone_code: codeSchema,
  earned_at: z.string().datetime().optional(),
});

const featuredSchema = z.object({
  user_id: uuidSchema,
  user_milestone_id: uuidSchema,
  position: z.number().int().min(1).max(3),
});

type QueryResult = { data: unknown; error: unknown };
type QueryBuilder = PromiseLike<QueryResult> & {
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  in(column: string, values: readonly unknown[]): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
};

export type MilestoneClient = {
  from(table: string): QueryBuilder;
  rpc(name: string, params: Record<string, unknown>): PromiseLike<QueryResult>;
};

export type PublicMilestone = {
  code: string;
  title: string;
  tier: string;
  theme_key: string | null;
  asset_key: string;
  position: number;
};

type FeaturedInput = z.infer<typeof featuredSchema>;
type EarnedInput = Pick<z.infer<typeof earnedSchema>, 'id' | 'user_id' | 'milestone_code'>;
type CatalogInput = Pick<z.infer<typeof catalogSchema>,
  'code' | 'title' | 'tier' | 'theme_key' | 'asset_key' | 'is_active' | 'is_shareable'>;

export function projectFeaturedMilestones(
  requestedUserIds: readonly string[],
  featuredRows: readonly FeaturedInput[],
  earnedRows: readonly EarnedInput[],
  catalogRows: readonly CatalogInput[],
) {
  const requested = new Set(requestedUserIds);
  const earnedById = new Map(earnedRows.map((row) => [row.id, row]));
  const catalogByCode = new Map(catalogRows.map((row) => [row.code, row]));
  const result = new Map<string, PublicMilestone[]>();
  for (const userId of requested) result.set(userId, []);

  const positionsByUser = new Map<string, Set<number>>();
  for (const featured of [...featuredRows].sort((a, b) => a.position - b.position)) {
    if (!requested.has(featured.user_id)) continue;
    const earned = earnedById.get(featured.user_milestone_id);
    if (!earned || earned.user_id !== featured.user_id) continue;
    const catalog = catalogByCode.get(earned.milestone_code);
    if (!catalog?.is_active || !catalog.is_shareable) continue;
    const occupied = positionsByUser.get(featured.user_id) ?? new Set<number>();
    if (occupied.has(featured.position) || (result.get(featured.user_id)?.length ?? 0) >= 3) continue;
    occupied.add(featured.position);
    positionsByUser.set(featured.user_id, occupied);
    result.get(featured.user_id)?.push({
      code: catalog.code,
      title: catalog.title,
      tier: catalog.tier ?? 'spark',
      theme_key: catalog.theme_key,
      asset_key: catalog.asset_key ?? 'milestone.generic',
      position: featured.position,
    });
  }
  return result;
}

export async function loadFeaturedMilestonesByUser(
  client: MilestoneClient,
  userIds: readonly string[],
) {
  const uniqueUserIds = [...new Set(userIds)].filter((value) => uuidSchema.safeParse(value).success);
  if (uniqueUserIds.length === 0) return new Map<string, PublicMilestone[]>();

  const featuredResult = await client.from('user_featured_milestones')
    .select('user_id,user_milestone_id,position')
    .in('user_id', uniqueUserIds)
    .order('position', { ascending: true });
  if (featuredResult.error) throw new Error('database_unavailable');
  const featured = z.array(featuredSchema).max(uniqueUserIds.length * 3).safeParse(featuredResult.data);
  if (!featured.success) throw new Error('invalid_response');

  const earnedIds = [...new Set(featured.data.map((row) => row.user_milestone_id))];
  if (earnedIds.length === 0) return projectFeaturedMilestones(uniqueUserIds, [], [], []);
  const earnedResult = await client.from('user_milestones')
    .select('id,user_id,milestone_code')
    .in('id', earnedIds);
  if (earnedResult.error) throw new Error('database_unavailable');
  const earned = z.array(earnedSchema.pick({ id: true, user_id: true, milestone_code: true }))
    .max(earnedIds.length).safeParse(earnedResult.data);
  if (!earned.success) throw new Error('invalid_response');

  const codes = [...new Set(earned.data.map((row) => row.milestone_code))];
  const catalogResult = await client.from('gamification_milestones')
    .select('code,title,tier,theme_key,asset_key,is_active,is_shareable')
    .in('code', codes);
  if (catalogResult.error) throw new Error('database_unavailable');
  const catalog = z.array(catalogSchema.pick({
    code: true, title: true, tier: true, theme_key: true, asset_key: true,
    is_active: true, is_shareable: true,
  })).max(codes.length).safeParse(catalogResult.data);
  if (!catalog.success) throw new Error('invalid_response');

  return projectFeaturedMilestones(uniqueUserIds, featured.data, earned.data, catalog.data);
}

export async function tryLoadFeaturedMilestonesByUser(
  client: MilestoneClient,
  userIds: readonly string[],
  stage: 'profile' | 'feed' | 'comments',
) {
  try {
    return await loadFeaturedMilestonesByUser(client, userIds);
  } catch {
    console.error('[rhythms-milestones]', {
      route: 'social_projection', stage, code: 'database_unavailable',
    });
    return null;
  }
}

export async function loadMilestoneCabinet(client: MilestoneClient, userId: string) {
  const [catalogResult, earnedResult, featuredResult] = await Promise.all([
    client.from('gamification_milestones')
      .select('code,title,description,category,tier,theme_key,asset_key,display_priority,is_shareable,is_active')
      .eq('is_active', true)
      .order('display_priority', { ascending: true }),
    client.from('user_milestones')
      .select('id,user_id,milestone_code,earned_at')
      .eq('user_id', userId),
    client.from('user_featured_milestones')
      .select('user_id,user_milestone_id,position')
      .eq('user_id', userId)
      .order('position', { ascending: true }),
  ]);
  if (catalogResult.error || earnedResult.error || featuredResult.error) throw new Error('database_unavailable');
  const catalog = z.array(catalogSchema).max(128).safeParse(catalogResult.data);
  const earned = z.array(earnedSchema).max(128).safeParse(earnedResult.data);
  const featured = z.array(featuredSchema).max(3).safeParse(featuredResult.data);
  if (!catalog.success || !earned.success || !featured.success) throw new Error('invalid_response');

  const earnedByCode = new Map(earned.data.map((row) => [row.milestone_code, row]));
  const positionByEarnedId = new Map(featured.data.map((row) => [row.user_milestone_id, row.position]));
  return {
    schema_version: 1 as const,
    items: catalog.data.map((row) => {
      const earnedRow = earnedByCode.get(row.code);
      return {
        code: row.code,
        title: row.title,
        description: row.description ?? '',
        category: row.category ?? 'journey',
        tier: row.tier ?? 'spark',
        theme_key: row.theme_key,
        asset_key: row.asset_key ?? 'milestone.generic',
        is_shareable: row.is_shareable,
        earned_at: earnedRow?.earned_at ?? null,
        featured_position: earnedRow ? positionByEarnedId.get(earnedRow.id) ?? null : null,
      };
    }),
  };
}

export type ReplaceFeaturedResult =
  | { ok: true; value: { schema_version: 1; featured_milestones: PublicMilestone[] } }
  | { ok: false; code: 'invalid_milestone' | 'database_unavailable' | 'invalid_response' };

export async function replaceFeaturedMilestones(
  client: MilestoneClient,
  userId: string,
  codes: readonly string[],
): Promise<ReplaceFeaturedResult> {
  const result = await client.rpc('replace_featured_milestones', {
    p_user_id: userId,
    p_codes: codes,
  });
  if (result.error) return { ok: false, code: 'database_unavailable' };
  const outcome = z.object({ outcome: z.enum(['updated', 'invalid_milestone']) }).safeParse(result.data);
  if (!outcome.success) return { ok: false, code: 'invalid_response' };
  if (outcome.data.outcome !== 'updated') return { ok: false, code: 'invalid_milestone' };
  try {
    const map = await loadFeaturedMilestonesByUser(client, [userId]);
    return {
      ok: true,
      value: { schema_version: 1, featured_milestones: map.get(userId) ?? [] },
    };
  } catch {
    return { ok: false, code: 'database_unavailable' };
  }
}
