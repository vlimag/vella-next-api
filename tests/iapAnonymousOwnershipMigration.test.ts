import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function migrationSource() {
  const migrationsPath = path.resolve(process.cwd(), '../supabase/migrations');
  const migrationName = fs.readdirSync(migrationsPath)
    .find((name) => name.endsWith('_anonymous_iap_ownership_transfer.sql'));
  expect(migrationName).toBeDefined();
  return fs.readFileSync(path.join(migrationsPath, migrationName!), 'utf8');
}

function signedOutAccessMigrationSource() {
  const migrationsPath = path.resolve(process.cwd(), '../supabase/migrations');
  const migrationName = fs.readdirSync(migrationsPath)
    .find((name) => name.endsWith('_preserve_store_access_after_vella_signout.sql'));
  expect(migrationName).toBeDefined();
  return fs.readFileSync(path.join(migrationsPath, migrationName!), 'utf8');
}

describe('anonymous IAP ownership migration contract', () => {
  it('preserves the eleven-argument RPC and exact privacy-safe response shape', () => {
    const migration = migrationSource();
    const syncFunction = migration.match(
      /create or replace function faith_harbor\.sync_iap_entitlement\([\s\S]*?\n\$\$;/,
    )?.[0] ?? '';
    const returnProjection = syncFunction.match(/returns table \(([\s\S]*?)\)\s*language/)?.[1] ?? '';

    expect(syncFunction).toMatch(
      /returns table \(\s*active boolean,\s*entitlement_code text,\s*ends_at timestamptz,\s*subscription_id uuid,\s*linked_to_other_account boolean\s*\)/,
    );
    expect(syncFunction).toContain('security definer');
    expect(syncFunction).toContain("set search_path = ''");
    expect(syncFunction).toMatch(/auth\.users[\s\S]*is_anonymous is true/);
    expect(syncFunction).toMatch(/set user_id = excluded\.user_id/);
    expect(syncFunction).toMatch(/update faith_harbor\.entitlements[\s\S]*user_id = p_user_id/);
    expect(syncFunction).toMatch(/update faith_harbor\.subscription_marketing_transitions[\s\S]*user_id = p_user_id/);
    expect(returnProjection).not.toMatch(/store_transaction_id|app_account_token|purchase_token|receipt/i);
  });

  it('is additive, service-role-only, and contains no destructive data operation', () => {
    const migration = migrationSource();

    expect(migration).toMatch(
      /revoke all on function faith_harbor\.sync_iap_entitlement\([\s\S]*?\) from public, anon, authenticated;/,
    );
    expect(migration).toMatch(
      /grant execute on function faith_harbor\.sync_iap_entitlement\([\s\S]*?\) to service_role;/,
    );
    expect(migration).not.toMatch(/\b(?:drop table|drop column|truncate|delete from)\b/i);
  });

  it('grants anonymous store access without moving a permanent owner', () => {
    const migration = signedOutAccessMigrationSource();

    expect(migration).toMatch(/v_requester_is_anonymous and not v_previous_owner_is_anonymous/);
    expect(migration).toContain("'access_scope', 'store_guest'");
    expect(migration).toMatch(
      /if not v_previous_owner_is_anonymous then[\s\S]*null::uuid, true;/,
    );
    expect(migration).toMatch(/pg_advisory_xact_lock/);
    expect(migration).not.toMatch(/\b(?:drop table|drop column|truncate|delete from)\b/i);
  });
});
