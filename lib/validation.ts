import { z } from 'zod';
import { fail } from '@/lib/http';

export const localeSchema = z.enum(['en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'pl']).default('en');
export const isoDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

type ParseSuccess<T> = { data: T };
type ParseFailure = { error: ReturnType<typeof fail> };

export function parseQuery<T>(schema: z.ZodSchema<T>, input: unknown): ParseSuccess<T> | ParseFailure {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: fail('Invalid request input', 400, parsed.error.flatten()) };
  }
  return { data: parsed.data };
}
