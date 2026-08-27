import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function migration(name: string) {
  return fs.readFileSync(
    path.resolve(process.cwd(), '../supabase/migrations', name),
    'utf8',
  );
}

describe('gathering content factory database contract', () => {
  it('defines privacy-safe releases and operational records', () => {
    const sql = migration('20260827210000_gathering_content_factory.sql');

    expect(sql).toContain('create table if not exists faith_harbor.gathering_releases');
    expect(sql).toContain("check (slot_type in ('monday', 'thursday'))");
    expect(sql).toContain('unique (release_week, slot_type)');
    expect(sql).toContain("source_kind = 'evergreen' and release_week is null");
    expect(sql).toContain('create table if not exists faith_harbor.gathering_operational_events');
    expect(sql).not.toMatch(/user_id|email|receipt|purchase_token|private_prayer/i);
    expect(sql).toContain('enable row level security');
    for (const code of [
      'gathering_first_light',
      'gathering_monthly_rhythm',
      'gathering_season_keeper',
      'gathering_long_companion',
    ]) {
      expect(sql).toContain(code);
    }
  });
});
