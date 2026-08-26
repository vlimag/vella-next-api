import { z } from 'zod';
import type { VerseNarrationVoice } from '@/lib/verseNarration';
import {
  createVersionedNarrationCacheKey,
  getOrCreateVersionedNarration,
  type VerseNarrationStorage,
} from '@/lib/verseNarrationCache';

const uuidSchema = z.string().uuid();
const templateSchema = z.object({
  id: uuidSchema,
  slug: z.literal('weekly-rest'),
  version: z.number().int().min(1).max(1_000),
  locale: z.enum(['en', 'pt', 'es', 'fr', 'de', 'it', 'pl', 'ru']),
  status: z.enum(['draft', 'published', 'retired']),
  available_from: z.string().datetime({ offset: true }).nullable(),
  available_until: z.string().datetime({ offset: true }).nullable(),
  editorial_revision: z.string().min(1).max(64),
});
const verseSchema = z.object({
  id: uuidSchema,
  text_content: z.string().min(1).max(4_096),
  language_code: z.string().min(1).max(16),
  bible_versions: z.object({ is_active: z.literal(true) }),
});
const rowSchema = z.object({
  id: uuidSchema,
  section_type: z.enum([
    'arrival', 'opening_prayer', 'scripture', 'reflection',
    'silence', 'private_prayer', 'action', 'closing',
  ]),
  editorial_text: z.string().min(1).max(4_000).nullable(),
  scripture_verse_id: uuidSchema.nullable(),
  narration_asset_key: z.string().min(1).max(128).nullable(),
  gathering_templates: templateSchema,
  bible_verses: verseSchema.nullable(),
});

const NARRATED_SECTIONS = new Set(['scripture', 'reflection', 'closing']);
const GATHERING_NARRATION_INSTRUCTIONS = 'calm-gathering-v1';

export type ApprovedGatheringNarration = {
  contentVersion: string;
  language: string;
  text: string;
};

export function resolveApprovedGatheringNarration(
  value: unknown,
  now = new Date(),
): ApprovedGatheringNarration | null {
  const parsed = rowSchema.safeParse(value);
  if (!parsed.success) return null;
  const row = parsed.data;
  const template = row.gathering_templates;
  if (template.status !== 'published' || !row.narration_asset_key) return null;
  if (!NARRATED_SECTIONS.has(row.section_type) || row.section_type === 'private_prayer') return null;
  const nowMs = now.getTime();
  if (template.available_from && new Date(template.available_from).getTime() > nowMs) return null;
  if (template.available_until && new Date(template.available_until).getTime() <= nowMs) return null;

  if (row.section_type === 'scripture') {
    if (!row.scripture_verse_id || !row.bible_verses || row.bible_verses.id !== row.scripture_verse_id) {
      return null;
    }
    return {
      contentVersion: `${template.slug}:${template.version}:${template.editorial_revision}`,
      language: row.bible_verses.language_code,
      text: row.bible_verses.text_content,
    };
  }

  if (!row.editorial_text || row.scripture_verse_id || row.bible_verses) return null;
  return {
    contentVersion: `${template.slug}:${template.version}:${template.editorial_revision}`,
    language: template.locale,
    text: row.editorial_text,
  };
}

type QueryResult = { data: unknown; error: unknown };
type QueryBuilder = PromiseLike<QueryResult> & {
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  maybeSingle(): PromiseLike<QueryResult>;
};
export type GatheringNarrationClient = {
  from(table: string): QueryBuilder;
};

export async function loadApprovedGatheringNarration(
  client: GatheringNarrationClient,
  templateId: string,
  stepId: string,
  now = new Date(),
): Promise<{ ok: true; value: ApprovedGatheringNarration | null } | { ok: false }> {
  try {
    const result = await client.from('gathering_template_steps')
      .select([
        'id',
        'section_type',
        'editorial_text',
        'scripture_verse_id',
        'narration_asset_key',
        'gathering_templates!inner(id,slug,version,locale,status,available_from,available_until,editorial_revision)',
        'bible_verses(id,text_content,language_code,bible_versions!inner(is_active))',
      ].join(','))
      .eq('id', stepId)
      .eq('gathering_template_id', templateId)
      .maybeSingle();
    if (result.error) return { ok: false };
    return { ok: true, value: resolveApprovedGatheringNarration(result.data, now) };
  } catch {
    return { ok: false };
  }
}

export function createGatheringNarrationCacheKey(input: {
  contentVersion: string;
  language: string;
  text: string;
  voice: VerseNarrationVoice;
}) {
  return createVersionedNarrationCacheKey({
    ...input,
    namespace: 'gathering',
    instructionsVersion: GATHERING_NARRATION_INSTRUCTIONS,
  });
}

export function getOrCreateGatheringNarration(input: {
  contentVersion: string;
  generate: () => Promise<ArrayBuffer>;
  language: string;
  storage: VerseNarrationStorage;
  text: string;
  voice: VerseNarrationVoice;
}) {
  return getOrCreateVersionedNarration({
    ...input,
    namespace: 'gathering',
    instructionsVersion: GATHERING_NARRATION_INSTRUCTIONS,
  });
}
