#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WORKSPACE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
shopt -s nullglob
ATTRIBUTION_MIGRATIONS=("$WORKSPACE_ROOT"/supabase/migrations/*_growth_install_attribution.sql)
ACL_CORRECTION_MIGRATIONS=(
  "$WORKSPACE_ROOT"/supabase/migrations/*_growth_install_attribution_acl_correction.sql
)
shopt -u nullglob

if [[ ${#ATTRIBUTION_MIGRATIONS[@]} -ne 1 || ! -f "${ATTRIBUTION_MIGRATIONS[0]}" ]]; then
  echo "expected exactly one growth install attribution migration" >&2
  exit 2
fi
if [[ ${#ACL_CORRECTION_MIGRATIONS[@]} -gt 1 ]]; then
  echo "expected at most one growth install attribution ACL correction migration" >&2
  exit 2
fi

MIGRATION_PATH=${ATTRIBUTION_MIGRATIONS[0]}
ACL_CORRECTION_PATH=${ACL_CORRECTION_MIGRATIONS[0]:-}
ATTRIBUTION_PG_ROOT=$(mktemp -d)
ATTRIBUTION_PG_DATA="$ATTRIBUTION_PG_ROOT/data"
ATTRIBUTION_PG_PORT=${ATTRIBUTION_PG_PORT:-$((55500 + $$ % 400))}

case "$ATTRIBUTION_PG_ROOT" in
  /tmp/*|/var/folders/*) ;;
  *) echo "refusing unsafe temporary PostgreSQL path" >&2; exit 2 ;;
esac

cleanup_attribution_postgres() {
  pg_ctl -D "$ATTRIBUTION_PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -r -- "$ATTRIBUTION_PG_ROOT"
}
trap cleanup_attribution_postgres EXIT

attribution_psql() {
  psql -v ON_ERROR_STOP=1 -h "$ATTRIBUTION_PG_ROOT" -p "$ATTRIBUTION_PG_PORT" postgres "$@"
}

initdb -D "$ATTRIBUTION_PG_DATA" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$ATTRIBUTION_PG_DATA" \
  -o "-F -p $ATTRIBUTION_PG_PORT -k $ATTRIBUTION_PG_ROOT" -w start >/dev/null

attribution_psql >/dev/null <<'SQL'
alter database postgres set timezone = 'UTC';
create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;
create schema faith_harbor;
grant usage on schema faith_harbor to anon, authenticated, service_role;

create table faith_harbor.profiles (
  id uuid primary key
);

create table faith_harbor.subscription_marketing_transitions (
  transition_id uuid primary key,
  user_id uuid,
  provider text not null,
  plan text not null,
  phase text not null,
  environment text not null,
  occurred_at timestamptz not null
);

-- Hosted Supabase grants service_role full table privileges through default
-- privileges. Reproduce that production behavior so a plain GRANT SELECT in
-- the feature migration cannot make the least-privilege test pass by accident.
alter default privileges in schema faith_harbor
grant all on tables to service_role;
SQL

attribution_psql -1 -f "$MIGRATION_PATH" >/dev/null
if [[ -n "$ACL_CORRECTION_PATH" ]]; then
  attribution_psql -1 -f "$ACL_CORRECTION_PATH" >/dev/null
fi

attribution_psql >/dev/null <<'SQL'
create function faith_harbor.test_record_android(
  p_installation_id uuid,
  p_campaign text default 'vella_br_android_202608_prayerdaily'
)
returns void
language sql
as $$
  select faith_harbor.record_growth_install_attribution(
    p_installation_id,
    'android',
    'play_install_referrer',
    'google',
    'cpc',
    p_campaign,
    'prayer_words_01',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    'resolved',
    true
  );
$$;

create function faith_harbor.test_record_unattributed_android(p_installation_id uuid)
returns void
language sql
as $$
  select faith_harbor.record_growth_install_attribution(
    p_installation_id,
    'android',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    'resolved',
    false
  );
$$;

create function faith_harbor.test_record_apple(p_installation_id uuid)
returns void
language plpgsql
as $$
declare
  v_lease uuid;
  v_resolved boolean;
begin
  select lease_id, already_resolved into v_lease, v_resolved
  from faith_harbor.preflight_growth_install_attribution(
    p_installation_id,
    'ios',
    false
  );
  if v_lease is null or v_resolved then
    raise exception 'Apple test fixture did not acquire a lease';
  end if;
  perform faith_harbor.finalize_growth_apple_attribution(
    p_installation_id,
    v_lease,
    true,
    40669820,
    542370539,
    542317095,
    87675432,
    542317136,
    'APPSTORE_SEARCH_RESULTS',
    'Download'
  );
end;
$$;

insert into faith_harbor.profiles (id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff'),
  ('99999999-9999-4999-8999-999999999999'),
  ('77777777-7777-4777-8777-777777777777'),
  ('66666666-6666-4666-8666-666666666666');

-- Link-before-capture creates a neutral pending row and retains the link.
select faith_harbor.link_growth_install_profile(
  '10000000-0000-4000-8000-000000000001',
  'android',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

do $verify_link_first$
begin
  if not exists (
    select 1
    from faith_harbor.growth_install_attribution as install
    where install.installation_id = '10000000-0000-4000-8000-000000000001'
      and install.platform = 'android'
      and install.resolution_status = 'pending'
      and install.attributed = false
      and install.distinct_users_ever = 1
  ) then
    raise exception 'link-before-capture did not create pending truth';
  end if;
end
$verify_link_first$;

select faith_harbor.test_record_android('10000000-0000-4000-8000-000000000001');
select faith_harbor.link_growth_install_profile(
  '10000000-0000-4000-8000-000000000001',
  'android',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

-- Capture-before-link is equally valid.
select faith_harbor.test_record_apple('10000000-0000-4000-8000-000000000002');
select faith_harbor.link_growth_install_profile(
  '10000000-0000-4000-8000-000000000002',
  'ios',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

do $verify_ordering$
begin
  if (
    select distinct_users_ever
    from faith_harbor.growth_install_attribution
    where installation_id = '10000000-0000-4000-8000-000000000001'
  ) <> 1 then
    raise exception 'same-user replay changed distinct-users truth';
  end if;

  begin
    perform faith_harbor.link_growth_install_profile(
      '10000000-0000-4000-8000-000000000002',
      'android',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    );
    raise exception 'platform mismatch was accepted';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'attribution_platform_mismatch' then raise; end if;
  end;

  begin
    perform faith_harbor.record_growth_install_attribution(
      '10000000-0000-4000-8000-000000000009',
      'ios',
      'apple_ads',
      null,
      null,
      null,
      null,
      40669820,
      542370539,
      542317095,
      null,
      null,
      null,
      'Download',
      'resolved',
      true
    );
    raise exception 'generic record path accepted terminal Apple truth';
  exception
    when sqlstate '22023' then
      if sqlerrm <> 'attribution_record_invalid' then raise; end if;
  end;
end
$verify_ordering$;

-- A transient iOS exchange leaves a linked neutral row pending.
select faith_harbor.link_growth_install_profile(
  '10000000-0000-4000-8000-000000000003',
  'ios',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

do $neutral_capture$
declare
  v_lease uuid;
  v_resolved boolean;
begin
  select lease_id, already_resolved into v_lease, v_resolved
  from faith_harbor.preflight_growth_install_attribution(
    '10000000-0000-4000-8000-000000000003', 'ios', false
  );
  if v_lease is null or v_resolved then
    raise exception 'pending iOS capture did not acquire a lease';
  end if;
  perform faith_harbor.record_growth_attribution_upstream_result(
    '10000000-0000-4000-8000-000000000003', v_lease, 'neutral'
  );
  if not exists (
    select 1
    from faith_harbor.growth_install_attribution as install
    join faith_harbor.growth_install_profile_links as link using (installation_id)
    where install.installation_id = '10000000-0000-4000-8000-000000000003'
      and install.resolution_status = 'pending'
      and link.user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) then
    raise exception 'transient exchange lost neutral linkage';
  end if;
end
$neutral_capture$;

-- A -> B is permanently ambiguous. Profile deletion removes only the current
-- association and cannot decrement or erase the install-row history.
select faith_harbor.link_growth_install_profile(
  '10000000-0000-4000-8000-000000000001',
  'android',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);

-- Deleting the only linked profile must erase the deterministic profile
-- derivative and seal the retained install as permanently ambiguous. This
-- preserves anti-reattribution truth without keeping a cross-install join key.
select faith_harbor.test_record_android('10000000-0000-4000-8000-000000000004');
select faith_harbor.link_growth_install_profile(
  '10000000-0000-4000-8000-000000000004',
  'android',
  '66666666-6666-4666-8666-666666666666'
);
delete from faith_harbor.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
delete from faith_harbor.profiles where id = '66666666-6666-4666-8666-666666666666';

do $verify_deletion_truth$
begin
  if not exists (
    select 1
    from faith_harbor.growth_install_attribution
    where installation_id = '10000000-0000-4000-8000-000000000001'
      and distinct_users_ever = 2
      and first_linked_profile_digest is null
      and permanently_ambiguous = true
  ) then
    raise exception 'account deletion erased permanent ambiguity';
  end if;
  if not exists (
    select 1
    from faith_harbor.growth_install_attribution
    where installation_id = '10000000-0000-4000-8000-000000000004'
      and distinct_users_ever = 2
      and first_linked_profile_digest is null
      and permanently_ambiguous = true
  ) then
    raise exception 'single-user deletion retained a linkable profile digest';
  end if;
  if exists (
    select 1 from faith_harbor.growth_install_profile_links
    where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) then
    raise exception 'account deletion retained a current profile link';
  end if;
end
$verify_deletion_truth$;

insert into faith_harbor.profiles (id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select faith_harbor.link_growth_install_profile(
  '10000000-0000-4000-8000-000000000001',
  'android',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
select faith_harbor.link_growth_install_profile(
  '10000000-0000-4000-8000-000000000001',
  'android',
  '77777777-7777-4777-8777-777777777777'
);

do $verify_ambiguity_cap$
begin
  if not exists (
    select 1 from faith_harbor.growth_install_attribution
    where installation_id = '10000000-0000-4000-8000-000000000001'
      and distinct_users_ever = 2
      and permanently_ambiguous = true
  ) then
    raise exception 'third distinct profile escaped the permanent ambiguity cap';
  end if;
end
$verify_ambiguity_cap$;

-- Two source-qualified installs blend. One approved registry match plus one
-- arbitrary directional code leaves exactly one qualified source.
select faith_harbor.test_record_android('20000000-0000-4000-8000-000000000001');
select faith_harbor.test_record_android('20000000-0000-4000-8000-000000000002');
select faith_harbor.link_growth_install_profile(
  '20000000-0000-4000-8000-000000000001', 'android',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
);
select faith_harbor.link_growth_install_profile(
  '20000000-0000-4000-8000-000000000002', 'android',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
);

select faith_harbor.test_record_android('20000000-0000-4000-8000-000000000003');
select faith_harbor.test_record_android(
  '20000000-0000-4000-8000-000000000004',
  'unregistered_directional_campaign'
);
select faith_harbor.link_growth_install_profile(
  '20000000-0000-4000-8000-000000000003', 'android',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
);
select faith_harbor.link_growth_install_profile(
  '20000000-0000-4000-8000-000000000004', 'android',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
);

do $verify_profile_rollup$
begin
  if not exists (
    select 1 from faith_harbor.growth_profile_attribution_truth
    where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      and current_install_count = 2
      and source_qualified_install_count = 2
      and attribution_scope = 'platform_blended'
  ) then
    raise exception 'two qualified installs were not blended';
  end if;
  if not exists (
    select 1 from faith_harbor.growth_profile_attribution_truth
    where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      and current_install_count = 2
      and source_qualified_install_count = 1
      and attribution_scope = 'source_qualified'
      and campaign = 'vella_br_android_202608_prayerdaily'
  ) then
    raise exception 'exactly-one source rule rejected the approved registry match';
  end if;
end
$verify_profile_rollup$;

-- Provider, platform, production-only, and the conservative 30-day window are
-- enforced for subscription transition truth.
select faith_harbor.test_record_apple('30000000-0000-4000-8000-000000000001');
select faith_harbor.link_growth_install_profile(
  '30000000-0000-4000-8000-000000000001', 'ios',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
);
update faith_harbor.growth_install_attribution
set captured_at = clock_timestamp() - interval '31 days'
where installation_id = '30000000-0000-4000-8000-000000000001';

select faith_harbor.test_record_android('30000000-0000-4000-8000-000000000002');
select faith_harbor.link_growth_install_profile(
  '30000000-0000-4000-8000-000000000002', 'android',
  'ffffffff-ffff-4fff-8fff-ffffffffffff'
);

-- Pending capture is retained for retry but can never claim source,
-- unattributed, or organic reporting truth.
select faith_harbor.link_growth_install_profile(
  '30000000-0000-4000-8000-000000000003', 'ios',
  '99999999-9999-4999-8999-999999999999'
);

insert into faith_harbor.subscription_marketing_transitions (
  transition_id, user_id, provider, plan, phase, environment, occurred_at
) values
  ('40000000-0000-4000-8000-000000000001', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'google', 'yearly', 'paid', 'production', clock_timestamp()),
  ('40000000-0000-4000-8000-000000000002', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'google', 'yearly', 'trial', 'production', clock_timestamp()),
  ('40000000-0000-4000-8000-000000000003', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'apple', 'monthly', 'paid', 'production', clock_timestamp()),
  ('40000000-0000-4000-8000-000000000004', 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'apple', 'monthly', 'paid', 'production', clock_timestamp()),
  ('40000000-0000-4000-8000-000000000005', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'google', 'yearly', 'paid', 'sandbox', clock_timestamp()),
  ('40000000-0000-4000-8000-000000000006', '99999999-9999-4999-8999-999999999999', 'apple', 'monthly', 'paid', 'production', clock_timestamp());

do $verify_transition_truth$
begin
  if not exists (
    select 1
    from faith_harbor.growth_subscription_attribution_truth(
      clock_timestamp() - interval '1 day', clock_timestamp() + interval '1 day'
    )
    where transition_id = '40000000-0000-4000-8000-000000000001'
      and attribution_scope = 'platform_blended'
  ) then
    raise exception 'multi-install transition was not blended';
  end if;
  if not exists (
    select 1
    from faith_harbor.growth_subscription_attribution_truth(
      clock_timestamp() - interval '1 day', clock_timestamp() + interval '1 day'
    )
    where transition_id = '40000000-0000-4000-8000-000000000002'
      and attribution_scope = 'source_qualified'
      and subscription_provider = 'google'
      and platform = 'android'
  ) then
    raise exception 'single approved transition was not source-qualified';
  end if;
  if exists (
    select 1
    from faith_harbor.growth_subscription_attribution_truth(
      clock_timestamp() - interval '1 day', clock_timestamp() + interval '1 day'
    )
    where transition_id = '40000000-0000-4000-8000-000000000003'
      and attribution_scope <> 'platform_blended'
  ) then
    raise exception 'out-of-window Apple install was attributed';
  end if;
  if exists (
    select 1
    from faith_harbor.growth_subscription_attribution_truth(
      clock_timestamp() - interval '1 day', clock_timestamp() + interval '1 day'
    )
    where transition_id = '40000000-0000-4000-8000-000000000004'
      and attribution_scope <> 'platform_blended'
  ) then
    raise exception 'provider/platform mismatch was attributed';
  end if;
  if exists (
    select 1
    from faith_harbor.growth_subscription_attribution_truth(
      clock_timestamp() - interval '1 day', clock_timestamp() + interval '1 day'
    )
    where transition_id = '40000000-0000-4000-8000-000000000005'
  ) then
    raise exception 'non-production transition entered attribution truth';
  end if;
  if not exists (
    select 1
    from faith_harbor.growth_subscription_attribution_truth(
      clock_timestamp() - interval '1 day', clock_timestamp() + interval '1 day'
    )
    where transition_id = '40000000-0000-4000-8000-000000000006'
      and attribution_scope = 'platform_blended'
      and platform is null
      and attribution_provider is null
      and campaign is null
  ) then
    raise exception 'pending install entered source or unattributed truth';
  end if;
  if not exists (
    select 1 from faith_harbor.growth_profile_attribution_truth
    where user_id = '99999999-9999-4999-8999-999999999999'
      and current_install_count = 1
      and source_qualified_install_count = 0
      and attribution_scope = 'platform_blended'
      and platform is null
      and provider is null
  ) then
    raise exception 'pending profile attribution was not safely blended';
  end if;
end
$verify_transition_truth$;

-- Resolved replay is free/idempotent. A resolved unattributed Android row may
-- still upgrade only when a later request actually carries coarse attribution.
select faith_harbor.test_record_unattributed_android('50000000-0000-4000-8000-000000000001');

do $verify_replay$
declare
  v_before integer;
  v_after integer;
  v_lease uuid;
  v_resolved boolean;
begin
  select request_count into v_before
  from faith_harbor.growth_attribution_global_state where singleton = true;

  select lease_id, already_resolved into v_lease, v_resolved
  from faith_harbor.preflight_growth_install_attribution(
    '10000000-0000-4000-8000-000000000002', 'ios', false
  );
  if not v_resolved or v_lease is not null then
    raise exception 'resolved iOS replay was not idempotent';
  end if;

  select lease_id, already_resolved into v_lease, v_resolved
  from faith_harbor.preflight_growth_install_attribution(
    '50000000-0000-4000-8000-000000000001', 'android', false
  );
  if not v_resolved then
    raise exception 'empty Android replay was not idempotent';
  end if;

  select request_count into v_after
  from faith_harbor.growth_attribution_global_state where singleton = true;
  if v_after <> v_before then
    raise exception 'resolved replay consumed global capacity';
  end if;

  select lease_id, already_resolved into v_lease, v_resolved
  from faith_harbor.preflight_growth_install_attribution(
    '50000000-0000-4000-8000-000000000001', 'android', true
  );
  if v_resolved then
    raise exception 'attributed Android upgrade was incorrectly short-circuited';
  end if;
  perform faith_harbor.test_record_android('50000000-0000-4000-8000-000000000001');

  -- First attributed truth wins permanently: neither a later empty record nor
  -- different directional values may downgrade or overwrite it.
  perform faith_harbor.test_record_unattributed_android(
    '50000000-0000-4000-8000-000000000001'
  );
  perform faith_harbor.test_record_android(
    '50000000-0000-4000-8000-000000000001',
    'different_campaign'
  );

  if not exists (
    select 1 from faith_harbor.growth_install_attribution
    where installation_id = '50000000-0000-4000-8000-000000000001'
      and resolution_status = 'resolved'
      and attributed = true
      and source = 'google'
      and campaign = 'vella_br_android_202608_prayerdaily'
  ) then
    raise exception 'upgrade-only first-attributed truth failed';
  end if;
end
$verify_replay$;

-- Apple terminal truth, lease release, and breaker success are one transaction.
-- A process crash/lost HTTP response after this commit replays for free without
-- leaving the prior failure streak armed.
do $verify_atomic_apple_finalization$
declare
  v_lease uuid;
  v_replay_lease uuid;
  v_resolved boolean;
begin
  update faith_harbor.growth_attribution_global_state
  set consecutive_upstream_failures = 4,
      open_until = null
  where singleton = true;

  select lease_id, already_resolved into v_lease, v_resolved
  from faith_harbor.preflight_growth_install_attribution(
    '50000000-0000-4000-8000-000000000004', 'ios', false
  );
  if v_lease is null or v_resolved then
    raise exception 'crash-phase fixture did not acquire a lease';
  end if;

  perform faith_harbor.finalize_growth_apple_attribution(
    '50000000-0000-4000-8000-000000000004',
    v_lease,
    true,
    40669820,
    542370539,
    542317095,
    87675432,
    542317136,
    'APPSTORE_SEARCH_RESULTS',
    'Download'
  );

  if not exists (
    select 1
    from faith_harbor.growth_install_attribution
    where installation_id = '50000000-0000-4000-8000-000000000004'
      and platform = 'ios'
      and resolution_status = 'resolved'
      and attributed = true
      and ad_id = 542317136
  ) then
    raise exception 'atomic Apple finalizer did not persist terminal truth';
  end if;
  if exists (
    select 1 from faith_harbor.growth_attribution_ingest_limits
    where installation_id = '50000000-0000-4000-8000-000000000004'
      and active_lease_id is not null
  ) then
    raise exception 'atomic Apple finalizer did not release its lease';
  end if;
  if (
    select consecutive_upstream_failures
    from faith_harbor.growth_attribution_global_state where singleton = true
  ) <> 0 then
    raise exception 'atomic Apple finalizer did not reset breaker success state';
  end if;

  select lease_id, already_resolved into v_replay_lease, v_resolved
  from faith_harbor.preflight_growth_install_attribution(
    '50000000-0000-4000-8000-000000000004', 'ios', false
  );

  if not v_resolved or v_replay_lease is not null then
    raise exception 'resolved crash-phase replay was not free/idempotent';
  end if;
  if (
    select consecutive_upstream_failures
    from faith_harbor.growth_attribution_global_state where singleton = true
  ) <> 0 then
    raise exception 'resolved replay re-armed the global breaker';
  end if;
end
$verify_atomic_apple_finalization$;

-- Anonymous truth that can no longer enter the 30-day conversion window is
-- purged in bounded batches. Any row carrying permanent account-switch truth
-- survives even after its current links are gone.
insert into faith_harbor.growth_install_attribution (
  installation_id, platform, captured_at, created_at, updated_at
) values (
  '50000000-0000-4000-8000-000000000005',
  'android',
  clock_timestamp() - interval '94 days',
  clock_timestamp() - interval '94 days',
  clock_timestamp() - interval '94 days'
), (
  '50000000-0000-4000-8000-000000000007',
  'ios',
  clock_timestamp() - interval '94 days',
  clock_timestamp() - interval '94 days',
  clock_timestamp() - interval '94 days'
);
insert into faith_harbor.growth_attribution_ingest_limits (
  installation_id, active_lease_id, active_lease_expires_at, updated_at
) values (
  '50000000-0000-4000-8000-000000000007',
  '88888888-8888-4888-8888-888888888888',
  clock_timestamp() + interval '30 seconds',
  clock_timestamp()
), (
  '50000000-0000-4000-8000-000000000008',
  '88888888-8888-4888-8888-888888888889',
  clock_timestamp() - interval '8 days',
  clock_timestamp() - interval '8 days'
);
delete from faith_harbor.growth_install_profile_links
where installation_id = '10000000-0000-4000-8000-000000000001';
update faith_harbor.growth_install_attribution
set captured_at = clock_timestamp() - interval '94 days'
where installation_id = '10000000-0000-4000-8000-000000000001';

do $verify_retention_cleanup$
declare
  v_lease uuid;
  v_resolved boolean;
begin
  select lease_id, already_resolved into v_lease, v_resolved
  from faith_harbor.preflight_growth_install_attribution(
    '50000000-0000-4000-8000-000000000006', 'android', false
  );
  perform faith_harbor.test_record_unattributed_android(
    '50000000-0000-4000-8000-000000000006'
  );

  if exists (
    select 1 from faith_harbor.growth_install_attribution
    where installation_id = '50000000-0000-4000-8000-000000000005'
  ) then
    raise exception 'expired anonymous attribution truth was not purged';
  end if;
  if not exists (
    select 1 from faith_harbor.growth_install_attribution
    where installation_id = '10000000-0000-4000-8000-000000000001'
      and distinct_users_ever = 2
      and permanently_ambiguous = true
  ) then
    raise exception 'retention cleanup erased permanent ambiguity truth';
  end if;
  if not exists (
    select 1 from faith_harbor.growth_install_attribution
    where installation_id = '50000000-0000-4000-8000-000000000007'
  ) then
    raise exception 'retention cleanup erased an active Apple lease stub';
  end if;
  if exists (
    select 1 from faith_harbor.growth_attribution_ingest_limits
    where installation_id = '50000000-0000-4000-8000-000000000008'
  ) then
    raise exception 'retention cleanup kept an expired abandoned lease bucket';
  end if;
end
$verify_retention_cleanup$;

-- Invalid classification and an active-lease collision are non-consuming.
do $verify_preflight_atomicity$
declare
  v_before integer;
  v_after integer;
  v_lease uuid;
  v_resolved boolean;
  v_failures smallint;
begin
  select request_count into v_before
  from faith_harbor.growth_attribution_global_state where singleton = true;
  begin
    perform * from faith_harbor.preflight_growth_install_attribution(
      '50000000-0000-4000-8000-000000000002', 'web', false
    );
    raise exception 'invalid platform was accepted';
  exception
    when sqlstate '22023' then null;
  end;
  begin
    perform * from faith_harbor.preflight_growth_install_attribution(
      '50000000-0000-4000-8000-000000000002', null, false
    );
    raise exception 'null platform was accepted';
  exception
    when sqlstate '22023' then null;
  end;
  select request_count into v_after
  from faith_harbor.growth_attribution_global_state where singleton = true;
  if v_after <> v_before then
    raise exception 'invalid classification consumed global capacity';
  end if;

  select lease_id, already_resolved into v_lease, v_resolved
  from faith_harbor.preflight_growth_install_attribution(
    '50000000-0000-4000-8000-000000000003', 'ios', false
  );
  select request_count into v_before
  from faith_harbor.growth_attribution_global_state where singleton = true;
  begin
    perform * from faith_harbor.preflight_growth_install_attribution(
      '50000000-0000-4000-8000-000000000003', 'ios', false
    );
    raise exception 'active lease collision was accepted';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'attribution_install_lease_active' then raise; end if;
  end;
  select request_count into v_after
  from faith_harbor.growth_attribution_global_state where singleton = true;
  if v_after <> v_before then
    raise exception 'active lease collision consumed capacity';
  end if;

  select consecutive_upstream_failures into v_failures
  from faith_harbor.growth_attribution_global_state where singleton = true;
  begin
    perform faith_harbor.record_growth_attribution_upstream_result(
      '50000000-0000-4000-8000-000000000003', v_lease, 'invented'
    );
    raise exception 'invalid upstream classification was accepted';
  exception
    when sqlstate '22023' then null;
  end;
  begin
    perform faith_harbor.record_growth_attribution_upstream_result(
      '50000000-0000-4000-8000-000000000003', v_lease, null
    );
    raise exception 'null upstream classification was accepted';
  exception
    when sqlstate '22023' then null;
  end;
  if not exists (
    select 1 from faith_harbor.growth_attribution_ingest_limits
    where installation_id = '50000000-0000-4000-8000-000000000003'
      and active_lease_id = v_lease
  ) then
    raise exception 'invalid upstream classification released the lease';
  end if;
  if (
    select consecutive_upstream_failures
    from faith_harbor.growth_attribution_global_state where singleton = true
  ) <> v_failures then
    raise exception 'invalid upstream classification consumed breaker state';
  end if;
  perform faith_harbor.record_growth_attribution_upstream_result(
    '50000000-0000-4000-8000-000000000003', v_lease, 'neutral'
  );
end
$verify_preflight_atomicity$;

-- Five classified upstream failures open the fixed breaker. The rejected
-- request does not consume another global slot.
update faith_harbor.growth_attribution_global_state
set window_started_at = clock_timestamp(),
    request_count = 0,
    consecutive_upstream_failures = 0,
    open_until = null;

do $verify_circuit_breaker$
declare
  v_install uuid;
  v_lease uuid;
  v_resolved boolean;
  v_before integer;
begin
  foreach v_install in array array[
    '60000000-0000-4000-8000-000000000001'::uuid,
    '60000000-0000-4000-8000-000000000002'::uuid,
    '60000000-0000-4000-8000-000000000003'::uuid,
    '60000000-0000-4000-8000-000000000004'::uuid,
    '60000000-0000-4000-8000-000000000005'::uuid
  ] loop
    select lease_id, already_resolved into v_lease, v_resolved
    from faith_harbor.preflight_growth_install_attribution(v_install, 'ios', false);
    perform faith_harbor.record_growth_attribution_upstream_result(
      v_install, v_lease, 'upstream_failure'
    );
  end loop;

  if not exists (
    select 1 from faith_harbor.growth_attribution_global_state
    where consecutive_upstream_failures = 5
      and open_until > clock_timestamp()
  ) then
    raise exception 'five failures did not open the circuit';
  end if;

  select request_count into v_before
  from faith_harbor.growth_attribution_global_state where singleton = true;
  begin
    perform * from faith_harbor.preflight_growth_install_attribution(
      '60000000-0000-4000-8000-000000000006', 'android', false
    );
    raise exception 'open circuit accepted a request';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'attribution_global_circuit_breaker_open' then raise; end if;
  end;
  if (
    select request_count
    from faith_harbor.growth_attribution_global_state where singleton = true
  ) <> v_before then
    raise exception 'open-circuit rejection consumed global capacity';
  end if;
end
$verify_circuit_breaker$;

-- RLS/ACL/search_path contract.
do $verify_acl$
declare
  v_table text;
  v_function text;
begin
  foreach v_table in array array[
    'growth_install_attribution',
    'growth_install_profile_links',
    'growth_attribution_ingest_limits',
    'growth_attribution_global_state'
  ] loop
    if not exists (
      select 1
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'faith_harbor'
        and relation.relname = v_table
        and relation.relrowsecurity
        and relation.relforcerowsecurity
    ) then
      raise exception 'RLS missing for %', v_table;
    end if;
    if has_table_privilege('anon', 'faith_harbor.' || v_table, 'select')
       or has_table_privilege('authenticated', 'faith_harbor.' || v_table, 'select')
       or has_table_privilege('public', 'faith_harbor.' || v_table, 'select') then
      raise exception 'client table privilege leaked for %', v_table;
    end if;
    if not has_table_privilege('service_role', 'faith_harbor.' || v_table, 'select') then
      raise exception 'service table privilege missing for %', v_table;
    end if;
    if has_table_privilege('service_role', 'faith_harbor.' || v_table, 'truncate')
       or has_table_privilege('service_role', 'faith_harbor.' || v_table, 'references')
       or has_table_privilege('service_role', 'faith_harbor.' || v_table, 'trigger') then
      raise exception 'service table privilege is broader than required for %', v_table;
    end if;
  end loop;

  if has_table_privilege(
       'service_role', 'faith_harbor.growth_install_attribution', 'insert,update,delete'
     )
     or has_table_privilege(
       'service_role', 'faith_harbor.growth_attribution_ingest_limits', 'insert,update,delete'
     )
     or has_table_privilege(
       'service_role', 'faith_harbor.growth_attribution_global_state', 'insert,update,delete'
     )
     or has_table_privilege(
       'service_role', 'faith_harbor.growth_install_profile_links', 'insert,update'
     )
     or not has_table_privilege(
       'service_role', 'faith_harbor.growth_install_profile_links', 'delete'
     ) then
    raise exception 'service attribution DML is broader or narrower than required';
  end if;

  if has_table_privilege('anon', 'faith_harbor.growth_profile_attribution_truth', 'select')
     or has_table_privilege('authenticated', 'faith_harbor.growth_profile_attribution_truth', 'select')
     or has_table_privilege('public', 'faith_harbor.growth_profile_attribution_truth', 'select')
     or not has_table_privilege('service_role', 'faith_harbor.growth_profile_attribution_truth', 'select')
     or has_table_privilege(
       'service_role', 'faith_harbor.growth_profile_attribution_truth', 'insert,update,delete'
     ) then
    raise exception 'view ACL is not service-only';
  end if;

  if not exists (
    select 1 from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'faith_harbor'
      and relation.relname = 'growth_profile_attribution_truth'
      and relation.reloptions @> array['security_invoker=true']
  ) then
    raise exception 'reporting view is not security invoker';
  end if;

  foreach v_function in array array[
    'faith_harbor.preflight_growth_install_attribution(uuid,text,boolean)',
    'faith_harbor.record_growth_attribution_upstream_result(uuid,uuid,text)',
    'faith_harbor.record_growth_install_attribution(uuid,text,text,text,text,text,text,bigint,bigint,bigint,bigint,bigint,text,text,text,boolean)',
    'faith_harbor.finalize_growth_apple_attribution(uuid,uuid,boolean,bigint,bigint,bigint,bigint,bigint,text,text)',
    'faith_harbor.link_growth_install_profile(uuid,text,uuid)',
    'faith_harbor.get_growth_profile_attribution_truth(uuid)',
    'faith_harbor.growth_subscription_attribution_truth(timestamp with time zone,timestamp with time zone)'
  ] loop
    if pg_catalog.to_regprocedure(v_function) is null then
      raise exception 'expected function signature missing for %', v_function;
    end if;
    if has_function_privilege('anon', v_function, 'execute')
       or has_function_privilege('authenticated', v_function, 'execute')
       or has_function_privilege('public', v_function, 'execute')
       or not has_function_privilege('service_role', v_function, 'execute') then
      raise exception 'function ACL is not service-only for %', v_function;
    end if;
    if not exists (
      select 1
      from pg_proc as procedure
      join pg_namespace as namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'faith_harbor'
        and procedure.oid = pg_catalog.to_regprocedure(v_function)
        and procedure.proconfig = array['search_path=""']
    ) then
      raise exception 'empty search_path missing for %', v_function;
    end if;
  end loop;

  v_function := 'faith_harbor.seal_growth_install_profile_link_deletion()';
  if pg_catalog.to_regprocedure(v_function) is null then
    raise exception 'expected trigger function signature missing';
  end if;
  if has_function_privilege('anon', v_function, 'execute')
     or has_function_privilege('authenticated', v_function, 'execute')
     or has_function_privilege('public', v_function, 'execute')
     or has_function_privilege('service_role', v_function, 'execute') then
    raise exception 'trigger function must not be directly executable';
  end if;
  if not exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'faith_harbor'
      and procedure.oid = pg_catalog.to_regprocedure(v_function)
      and procedure.proconfig = array['search_path=""']
  ) then
    raise exception 'empty search_path missing for trigger function';
  end if;

  if exists (
    select 1
    from information_schema.columns as column_record
    where column_record.table_schema = 'faith_harbor'
      and column_record.table_name like 'growth_attribution%'
      and (
        column_record.column_name in (
          'token', 'raw_referrer', 'gclid', 'apple_body', 'raw_payload', 'device_fingerprint', 'placement_id'
        )
        or column_record.data_type in ('json', 'jsonb')
      )
  ) then
    raise exception 'forbidden attribution storage column exists';
  end if;
end
$verify_acl$;
SQL

echo "acquisition attribution integration checks passed"
