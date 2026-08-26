import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES = ['en', 'pt', 'es', 'fr', 'de', 'it', 'pl', 'ru'] as const;
const SECTION_ORDER = [
  'arrival',
  'opening_prayer',
  'scripture',
  'reflection',
  'silence',
  'private_prayer',
  'action',
  'closing',
] as const;

function migrationSql() {
  const migrationsPath = path.resolve(process.cwd(), '../supabase/migrations');
  const names = fs.readdirSync(migrationsPath).filter((name) => name.endsWith('_first_vella_gathering.sql'));
  expect(names).toHaveLength(1);
  return names.length === 1 ? fs.readFileSync(path.join(migrationsPath, names[0]!), 'utf8') : '';
}

describe('first Vella Gathering content contract', () => {
  it('seeds one immutable 12–18 minute Gathering in every supported locale', () => {
    const sql = migrationSql();

    expect(sql).toContain("'weekly-rest'");
    expect(sql).toMatch(/estimated_duration_seconds[\s\S]*900/i);
    expect(sql).toMatch(/editorial_revision[\s\S]*'editorial\.1'/i);
    expect(sql).toMatch(/status[\s\S]*'published'/i);
    expect(sql).toMatch(/available_from[\s\S]*2026-08-26/i);
    for (const locale of LOCALES) {
      expect(sql).toContain(`'${locale}'`);
      expect(sql).toContain(`weekly-rest:v1:${locale}:arrival`);
      expect(sql).toContain(`weekly-rest:v1:${locale}:closing`);
    }
  });

  it('uses the exact eight-section editorial order with a skippable private prompt', () => {
    const sql = migrationSql();
    for (const [index, section] of SECTION_ORDER.entries()) {
      const stepOrder = index + 1;
      expect(sql).toMatch(new RegExp(`${stepOrder},\\s*'${section}'`, 'i'));
    }
    expect(sql).toMatch(/6,\s*'private_prayer'[\s\S]*false/i);
  });

  it('references an approved stored verse and never seeds generated Scripture text', () => {
    const sql = migrationSql();

    expect(sql).toMatch(/scripture_verse_id uuid[\s\S]*references faith_harbor\.bible_verses/i);
    expect(sql).toMatch(/book\.code = 'MAT'[\s\S]*verse\.chapter = 11[\s\S]*verse\.verse = 28/i);
    expect(sql).toMatch(/version\.is_active = true/i);
    expect(sql).toMatch(/verse\.language_code in \(template\.locale, 'en'\)/i);
    expect(sql).not.toMatch(/insert into faith_harbor\.bible_verses/i);
  });

  it('exposes owner-bound service-role-only checkpoint RPCs and stores no private answer', () => {
    const sql = migrationSql();

    expect(sql).toMatch(/create or replace function faith_harbor\.get_current_gathering_v1/i);
    expect(sql).toMatch(/create or replace function faith_harbor\.save_gathering_progress_v1/i);
    expect(sql.match(/security invoker/gi)).toHaveLength(2);
    expect(sql.match(/set search_path = ''/gi)).toHaveLength(2);
    expect(sql).toMatch(/for update/i);
    expect(sql).toMatch(/completion_idempotency_key/i);
    expect(sql).toMatch(/source_type[\s\S]*'gathering'/i);
    expect(sql).toMatch(/practice_code[\s\S]*'guided_prayer'/i);
    expect(sql).toMatch(/revoke execute on function faith_harbor\.get_current_gathering_v1[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/revoke execute on function faith_harbor\.save_gathering_progress_v1[\s\S]*from public, anon, authenticated/i);
    expect(sql).not.toMatch(/private_(?:answer|response|text)|prayer_(?:answer|response|text)|journal_(?:answer|response|text)/i);
    expect(sql).not.toMatch(/\b(drop|truncate)\s+(table|schema)/i);
  });
});
