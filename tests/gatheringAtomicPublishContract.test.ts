import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('gathering atomic publish migration', () => {
  it('makes the service-role publish RPC validate all locales and steps before publishing', async () => {
    const sql = await readFile('../supabase/migrations/20260827210250_gathering_atomic_publish.sql', 'utf8');

    expect(sql).toContain('gathering_factory_claim_lease');
    expect(sql).toContain('gathering_factory_release_lease');
    expect(sql).toContain('where lease.token = p_token');
    expect(sql).not.toContain('pg_advisory_lock');
    expect(sql).not.toContain('auth.role()');
    expect(sql).toContain("count(*) from jsonb_object_keys(coalesce(p_content->'locales'");
    expect(sql).toContain("for v_index in 0..7 loop");
    expect(sql).toContain('on conflict (release_week, slot_type) do nothing');
    expect(sql).toContain("update faith_harbor.gathering_releases set status = 'published'");
  });
});
