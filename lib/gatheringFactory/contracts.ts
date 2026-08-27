import { z } from 'zod';

export const GATHERING_LOCALES = ['en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'pl'] as const;
export type GatheringLocale = (typeof GATHERING_LOCALES)[number];

export const GATHERING_SECTION_TYPES = [
  'arrival',
  'opening_prayer',
  'scripture',
  'reflection',
  'silence',
  'private_prayer',
  'action',
  'closing',
] as const;
export type GatheringSectionType = (typeof GATHERING_SECTION_TYPES)[number];

export const GATHERING_THEME_KEYS = [
  'peace',
  'strength',
  'guidance',
  'family',
  'gratitude',
  'rest',
  'hope',
  'healing',
  'forgiveness',
] as const;
export type GatheringThemeKey = (typeof GATHERING_THEME_KEYS)[number];

const editorialTextSchema = z.string().trim().min(1).max(4_000);
const localizedStepSchema = z.object({
  section_type: z.enum(GATHERING_SECTION_TYPES),
  body: editorialTextSchema,
}).strict();

const localizedGatheringSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(800),
  steps: z.array(localizedStepSchema).length(GATHERING_SECTION_TYPES.length),
}).strict();

const localizedGatheringFields = Object.fromEntries(
  GATHERING_LOCALES.map((locale) => [locale, localizedGatheringSchema]),
) as { [Locale in GatheringLocale]: typeof localizedGatheringSchema };

export const generatedGatheringSchema = z.object({
  schema_version: z.literal(1),
  theme_key: z.enum(GATHERING_THEME_KEYS),
  scripture_reference: z.string().trim().min(1).max(160),
  estimated_duration_seconds: z.number().int().min(720).max(1_080),
  locales: z.object(localizedGatheringFields).strict(),
}).strict();

export type GeneratedGathering = z.infer<typeof generatedGatheringSchema>;
export type GeneratedGatheringLocale = GeneratedGathering['locales'][GatheringLocale];

export const reviewDecisionSchema = z.object({
  approved: z.boolean(),
  reasons: z.array(z.string().trim().min(1).max(500)).max(12),
}).strict();

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
