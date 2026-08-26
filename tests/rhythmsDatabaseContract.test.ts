import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rhythmsTables = [
  'practice_definitions',
  'user_practices',
  'practice_sessions',
  'gathering_templates',
  'gathering_template_steps',
  'user_gathering_progress',
  'user_featured_milestones',
] as const;

const accountOwnedTables = [
  'user_practices',
  'practice_sessions',
  'user_gathering_progress',
  'user_featured_milestones',
] as const;

function loadMigration() {
  const migrationsPath = path.resolve(process.cwd(), '../supabase/migrations');
  const names = fs.readdirSync(migrationsPath)
    .filter((name) => name.endsWith('_vella_rhythms_foundation.sql'));
  expect(names).toHaveLength(1);
  if (names.length !== 1) return '';
  return fs.readFileSync(path.join(migrationsPath, names[0]!), 'utf8');
}

describe('Vella Rhythms foundation migration', () => {
  it('adds the complete non-devotional Rhythms foundation without destructive SQL', () => {
    const sql = loadMigration();

    for (const table of rhythmsTables) {
      expect(sql).toMatch(new RegExp(`create table(?: if not exists)? faith_harbor\\.${table}`, 'i'));
      expect(sql).toMatch(new RegExp(`alter table faith_harbor\\.${table} enable row level security`, 'i'));
    }

    expect(sql).toMatch(/alter table faith_harbor\.gamification_milestones[\s\S]*add column if not exists category/i);
    expect(sql).toMatch(/alter table faith_harbor\.user_journeys[\s\S]*add column if not exists timezone_name/i);
    expect(sql).toMatch(/unique \(user_id, practice_code\)/i);
    expect(sql).toMatch(/unique \(user_id, idempotency_key\)/i);
    expect(sql).toMatch(/unique \(user_id, source_type, source_key\)/i);
    expect(sql).toMatch(/unique \(user_id, gathering_template_id\)/i);
    expect(sql).toMatch(/unique \(user_id, user_milestone_id\)/i);
    expect(sql).toMatch(/unique \(user_id, position\)/i);
    expect(sql).toMatch(/foreign key \(user_milestone_id, user_id\)[\s\S]*references faith_harbor\.user_milestones \(id, user_id\)/i);
    expect(sql).toMatch(/position between 1 and 3/i);
    expect(sql).not.toMatch(/\b(?:prayer|reflection|devotional|audio|search|post)_(?:text|body|content)\b/i);
    expect(sql).not.toMatch(/drop\s+(?:table|column)/i);
    expect(sql).not.toMatch(/alter\s+column[\s\S]{0,80}\btype\b/i);
    expect(sql).not.toMatch(/rename\s+column/i);
  });

  it('uses explicit least-privilege grants and ownership policies', () => {
    const sql = loadMigration();

    for (const table of rhythmsTables) {
      expect(sql).toMatch(new RegExp(
        `revoke all on table faith_harbor\\.${table} from public, anon, authenticated`,
        'i',
      ));
      expect(sql).toMatch(new RegExp(`revoke all on table faith_harbor\\.${table} from service_role`, 'i'));
    }

    for (const table of ['practice_definitions', 'gathering_templates', 'gathering_template_steps']) {
      expect(sql).toMatch(new RegExp(`grant select on table faith_harbor\\.${table} to service_role`, 'i'));
    }
    for (const table of accountOwnedTables) {
      expect(sql).toMatch(new RegExp(
        `grant select, insert, update, delete on table faith_harbor\\.${table} to service_role`,
        'i',
      ));
      for (const command of ['select', 'insert', 'update', 'delete']) {
        const policy = sql.match(new RegExp(
          `create policy "${table} owner ${command}"[\\s\\S]*?;`,
          'i',
        ))?.[0] ?? '';
        expect(policy).toMatch(/to authenticated/i);
        expect(policy).toMatch(/auth\.uid\(\)\) = user_id/i);
        if (command === 'update') expect(policy).toMatch(/using[\s\S]*with check/i);
      }
    }

    expect(sql).toMatch(/practice_definitions catalog select[\s\S]*is_active = true/i);
    expect(sql).toMatch(/gathering_templates catalog select[\s\S]*status = 'published'/i);
    expect(sql).toMatch(/gathering_template_steps catalog select[\s\S]*status = 'published'/i);
  });

  it('seeds all six practices and canonical existing milestone metadata idempotently', () => {
    const sql = loadMigration();

    for (const code of [
      'guided_prayer',
      'scripture',
      'gratitude',
      'silence',
      'daily_reflection',
      'act_of_kindness',
    ]) {
      expect(sql).toContain(`'${code}'`);
    }
    expect(sql).toMatch(/insert into faith_harbor\.practice_definitions[\s\S]*on conflict \(code\) do update/i);
    expect(sql).toMatch(/insert into faith_harbor\.gamification_milestones[\s\S]*on conflict \(code\) do update/i);
    expect(sql).toContain("'streak_3'");
    expect(sql).toContain("'streak_7'");
    expect(sql).toContain("'journey_finisher'");
  });
});
