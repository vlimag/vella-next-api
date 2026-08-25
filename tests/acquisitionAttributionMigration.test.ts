import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function loadMigration() {
  const migrationsPath = path.resolve(process.cwd(), '../supabase/migrations');
  const names = fs.readdirSync(migrationsPath)
    .filter((name) => name.endsWith('_growth_install_attribution.sql'));
  expect(names).toHaveLength(1);
  if (names.length !== 1) return '';
  return fs.readFileSync(path.join(migrationsPath, names[0]!), 'utf8');
}

describe('growth install attribution migration', () => {
  it('creates only closed service-role tables without secret or raw payload columns', () => {
    const sql = loadMigration();

    expect(sql).toMatch(/create table faith_harbor\.growth_install_attribution/i);
    expect(sql).toMatch(/create table faith_harbor\.growth_install_profile_links/i);
    expect(sql).toMatch(/create table faith_harbor\.growth_attribution_ingest_limits/i);
    expect(sql).toMatch(/create table faith_harbor\.growth_attribution_global_state/i);
    const tableDefinitions = [...sql.matchAll(
      /create table faith_harbor\.[a-z0-9_]+\s*\([\s\S]*?\n\);/gi,
    )].map(([definition]) => definition).join('\n');
    expect(tableDefinitions).not.toMatch(
      /^\s*(?:token|raw_referrer|gclid|apple_body|raw_payload|device_fingerprint)\s+/im,
    );
    expect(tableDefinitions).not.toMatch(/^\s*[a-z0-9_]+\s+jsonb?\b/im);
    expect(sql).toContain('ad_id bigint');
    expect(sql).not.toContain('placement_id');
    expect(sql).toMatch(/conversion_type text[\s\S]*Download[\s\S]*Redownload[\s\S]*PreOrder/i);
    expect(sql).toMatch(/supply_placement text[\s\S]*APPSTORE_SEARCH_RESULTS/i);
    expect(sql).toMatch(/distinct_users_ever smallint[\s\S]*between 0 and 2/i);
    expect(sql).toMatch(/permanently_ambiguous boolean/i);
  });

  it('enforces RLS, provider/platform matching, and service-only ACLs on every object', () => {
    const sql = loadMigration();

    const tableGrants = {
      growth_install_attribution: 'select',
      growth_install_profile_links: 'select, delete',
      growth_attribution_ingest_limits: 'select',
      growth_attribution_global_state: 'select',
    } as const;
    for (const [table, privileges] of Object.entries(tableGrants)) {
      expect(sql).toMatch(new RegExp(`alter table faith_harbor\\.${table} enable row level security`, 'i'));
      expect(sql).toMatch(new RegExp(`alter table faith_harbor\\.${table} force row level security`, 'i'));
      expect(sql).toMatch(new RegExp(`revoke all on faith_harbor\\.${table} from public, anon, authenticated`, 'i'));
      expect(sql).toMatch(new RegExp(
        `grant ${privileges} on faith_harbor\\.${table} to service_role`,
        'i',
      ));
      expect(sql).not.toMatch(new RegExp(`grant all on faith_harbor\\.${table}`, 'i'));
    }
    expect(sql).toMatch(/platform = 'ios'[\s\S]*provider = 'apple_ads'/i);
    expect(sql).toMatch(/platform = 'android'[\s\S]*provider = 'play_install_referrer'/i);
    expect(sql).toMatch(/revoke all on faith_harbor\.growth_profile_attribution_truth from public, anon, authenticated/i);
    expect(sql).toMatch(/grant select on faith_harbor\.growth_profile_attribution_truth to service_role/i);
  });

  it('uses locked, upgrade-only writes and permanent ambiguity truth', () => {
    const sql = loadMigration();

    expect(sql).toContain("pg_advisory_xact_lock(pg_catalog.hashtextextended('growth_attribution_global', 0))");
    expect(sql).toMatch(/pg_advisory_xact_lock\([\s\S]*p_installation_id::text/i);
    expect(sql).toMatch(/attribution_rate_limit_exceeded/i);
    expect(sql).toMatch(/attribution_global_circuit_breaker_open/i);
    expect(sql).toMatch(/p_platform is null[\s\S]*p_platform not in \('ios', 'android'\)/i);
    const genericRecord = sql.match(
      /create or replace function faith_harbor\.record_growth_install_attribution\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? '';
    expect(genericRecord).toMatch(/p_platform <> 'android'/i);
    expect(sql).toMatch(/p_outcome is null[\s\S]*p_outcome not in \('success', 'neutral', 'upstream_failure'\)/i);
    expect(sql).toMatch(/existing\.attributed = false[\s\S]*excluded\.attributed = true/i);
    expect(sql).toMatch(/least\(2[,:][\s\S]*distinct_users_ever/i);
    expect(sql).toMatch(/on delete cascade/i);
    expect(sql).toMatch(/create trigger seal_growth_install_profile_link_deletion/i);
    expect(sql).toMatch(/before delete on faith_harbor\.growth_install_profile_links/i);
    expect(sql).toMatch(/distinct_users_ever = 2[\s\S]*first_linked_profile_digest = null[\s\S]*permanently_ambiguous = true/i);
    expect(sql).toMatch(/insert into faith_harbor\.growth_install_attribution[\s\S]*p_attributed[\s\S]*false/i);
    expect(sql).toContain("campaign = 'vella_br_android_202608_prayerdaily'");
    expect(sql).toMatch(/transition\.environment = 'production'/i);
    expect(sql).toMatch(/transition\.occurred_at - interval '30 days'/i);
    expect(sql).toMatch(/candidate_count = 1/i);
    expect(sql).toMatch(/candidate\.captured_at < v_now - interval '93 days'/i);
    expect(sql).toMatch(/candidate\.distinct_users_ever = 0/i);
    expect(sql).toMatch(/candidate\.installation_id <> p_installation_id/i);
    expect(sql).toMatch(/active_lease_id is not null[\s\S]*active_lease_expires_at > v_now/i);
    expect(sql).toMatch(/candidate\.active_lease_id is null[\s\S]*candidate\.active_lease_expires_at <= v_now/i);
    expect(sql).toMatch(/for update skip locked/i);
  });

  it('pins every callable function to an empty search_path and revokes default execution', () => {
    const sql = loadMigration();
    const functionNames = [
      'preflight_growth_install_attribution',
      'record_growth_install_attribution',
      'record_growth_attribution_upstream_result',
      'finalize_growth_apple_attribution',
      'link_growth_install_profile',
      'get_growth_profile_attribution_truth',
      'growth_subscription_attribution_truth',
    ];

    for (const name of functionNames) {
      const block = sql.match(new RegExp(
        `create or replace function faith_harbor\\.${name}\\([\\s\\S]*?\\n\\$\\$;`,
        'i',
      ))?.[0] ?? '';
      expect(block, `${name} definition`).not.toBe('');
      expect(block, `${name} search_path`).toMatch(/set search_path = ''/i);
      expect(sql).toMatch(new RegExp(
        `revoke all on function faith_harbor\\.${name}\\([^;]*\\)\\s+from public, anon, authenticated`,
        'i',
      ));
      expect(sql).toMatch(new RegExp(
        `grant execute on function faith_harbor\\.${name}\\([^;]*\\)\\s+to service_role`,
        'i',
      ));
    }

    const triggerFunction = sql.match(
      /create or replace function faith_harbor\.seal_growth_install_profile_link_deletion\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? '';
    expect(triggerFunction).not.toBe('');
    expect(triggerFunction).toMatch(/set search_path = ''/i);
    expect(sql).toMatch(
      /revoke all on function faith_harbor\.seal_growth_install_profile_link_deletion\(\)\s+from public, anon, authenticated, service_role/i,
    );
  });
});
