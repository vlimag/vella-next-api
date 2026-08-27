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

const editorialTextSchema = (max: number) => z.string()
  .max(max)
  .refine((value) => value.trim().length > 0, 'must contain non-whitespace text');

const editorialStepSchema = (section_type: Exclude<GatheringSectionType, 'scripture'>) => z.object({
  section_type: z.literal(section_type),
  body: editorialTextSchema(4_000),
}).strict();

const scriptureStepSchema = z.object({
  section_type: z.literal('scripture'),
}).strict();

const localizedStepsSchema = z.tuple([
  editorialStepSchema('arrival'),
  editorialStepSchema('opening_prayer'),
  scriptureStepSchema,
  editorialStepSchema('reflection'),
  editorialStepSchema('silence'),
  editorialStepSchema('private_prayer'),
  editorialStepSchema('action'),
  editorialStepSchema('closing'),
]);

const SCRIPTURE_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalm', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah',
  'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians',
  'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation',
] as const;

export const SCRIPTURE_REFERENCE_PATTERN = new RegExp(
  `^(?:${SCRIPTURE_BOOKS.map((book) => book.replaceAll(' ', '\\s+')).join('|')})\\s+\\d{1,3}:\\d{1,3}(?:-\\d{1,3})?$`,
);

const scriptureReferenceSchema = z.string().max(160).regex(SCRIPTURE_REFERENCE_PATTERN);

const localizedGatheringSchema = z.object({
  title: editorialTextSchema(160),
  summary: editorialTextSchema(800),
  steps: localizedStepsSchema,
}).strict();

const localizedGatheringFields = Object.fromEntries(
  GATHERING_LOCALES.map((locale) => [locale, localizedGatheringSchema]),
) as { [Locale in GatheringLocale]: typeof localizedGatheringSchema };

export const generatedGatheringSchema = z.object({
  schema_version: z.literal(1),
  theme_key: z.enum(GATHERING_THEME_KEYS),
  scripture_reference: scriptureReferenceSchema,
  estimated_duration_seconds: z.number().int().min(720).max(1_080),
  locales: z.object(localizedGatheringFields).strict(),
}).strict();

export type GeneratedGathering = z.infer<typeof generatedGatheringSchema>;
export type GeneratedGatheringLocale = GeneratedGathering['locales'][GatheringLocale];

export const reviewDecisionSchema = z.object({
  approved: z.boolean(),
  reasons: z.array(editorialTextSchema(500)).max(12),
}).strict();

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
