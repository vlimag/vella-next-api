import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  '../supabase/migrations/20260827210100_gathering_catalog_v2.sql',
);
const fixturePath = path.resolve(process.cwd(), 'tests/gatheringsV2Postgres.integration.sh');

describe('gathering v2 milestone integration fixture', () => {
  it('locks the first distinct release completion and awards each exact threshold once', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const fixture = fs.readFileSync(fixturePath, 'utf8');

    for (const code of [
      'gathering_first_light',
      'gathering_monthly_rhythm',
      'gathering_season_keeper',
      'gathering_long_companion',
    ]) {
      expect(sql).toContain(`'${code}'`);
      expect(fixture).toContain(`'${code}'`);
    }

    expect(fixture).toContain('same release completion was counted twice');
    expect(fixture).toContain('milestone threshold was not awarded exactly once');
    expect(fixture).toContain('new_milestone_codes leaked an unexpected value');
    expect(fixture).toContain('count(distinct release_id)');
    expect(fixture).toContain('run_concurrent_threshold');
    expect(fixture).toContain('concurrent threshold badge was missed or duplicated');
    expect(fixture).toContain('gathering_monthly_rhythm');
    expect(fixture).toContain('gathering_season_keeper');
    expect(fixture).toContain('gathering_long_companion');
    expect(fixture).toContain('pg_sleep(0.25)');
    expect(fixture).toContain('v1 weekly-rest response was not executable');
    expect(fixture).toContain('idx_user_gathering_progress_completion_key');
    expect(fixture).toContain('cross-template idempotency key did not return a finite conflict');
    expect(fixture).toContain('same-template idempotent retry was not preserved');
    expect(fixture).toContain('run_concurrent_cross_template_idempotency');
    expect(fixture).toContain('concurrent cross-template idempotency key did not produce exactly one completion and one conflict');
    expect(fixture).toContain('concurrent cross-template idempotency key leaked a raw database error');
  });
});
