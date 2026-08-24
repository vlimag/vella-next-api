#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MIGRATION_PATH="$SCRIPT_DIR/../../supabase/migrations/20260824230422_subscription_marketing_transitions.sql"
TASK3_PG_ROOT=$(mktemp -d)
TASK3_PG_DATA="$TASK3_PG_ROOT/data"
TASK3_PG_PORT=${TASK3_PG_PORT:-55439}

case "$TASK3_PG_ROOT" in
  /tmp/*|/var/folders/*) ;;
  *) exit 1 ;;
esac

cleanup_task3_postgres() {
  pg_ctl -D "$TASK3_PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -r -- "$TASK3_PG_ROOT"
}
trap cleanup_task3_postgres EXIT

task3_psql() {
  psql -v ON_ERROR_STOP=1 -h "$TASK3_PG_ROOT" -p "$TASK3_PG_PORT" postgres "$@"
}

wait_for_advisory_lock() {
  local lock_id=$1
  local attempt
  for attempt in $(seq 1 100); do
    if [[ $(task3_psql -Atc "select count(*) from pg_locks where locktype = 'advisory' and objid = $lock_id and granted") == "1" ]]; then
      return 0
    fi
    sleep 0.05
  done
  return 1
}

initdb -D "$TASK3_PG_DATA" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$TASK3_PG_DATA" -o "-F -p $TASK3_PG_PORT -k $TASK3_PG_ROOT" -w start >/dev/null

task3_psql >/dev/null <<'SQL'
create extension if not exists pgcrypto;
create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create schema faith_harbor;
grant usage on schema faith_harbor to anon, authenticated, service_role;

create table faith_harbor.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  store_product_id text not null,
  store_transaction_id text not null,
  status text not null,
  plan_code text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  store_event_at timestamptz,
  unique (provider, store_transaction_id)
);

create table faith_harbor.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  subscription_id uuid references faith_harbor.subscriptions(id) on delete set null,
  entitlement_code text not null,
  source text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  active boolean not null,
  metadata jsonb not null default '{}'::jsonb
);

create function faith_harbor.apply_iap_subscription_state(
  p_provider text,
  p_store_transaction_id text,
  p_active boolean,
  p_ends_at timestamptz,
  p_event_at timestamptz,
  p_auto_renew boolean default null
)
returns table (updated boolean, stale boolean, subscription_id uuid)
language sql
as $$ select false, false, null::uuid $$;
SQL

task3_psql -f "$MIGRATION_PATH" >/dev/null

task3_psql >/dev/null <<'SQL'
insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

-- Direct duplicate and paid-before-late-trial ordering.
select * from faith_harbor.sync_iap_entitlement(
  '11111111-1111-4111-8111-111111111111', 'apple', 'vella.premium.yearly',
  'direct-duplicate', true, 'premium_individual', now() + interval '14 days',
  true, 'ios', 'Production', 'trial'
);
select * from faith_harbor.sync_iap_entitlement(
  '11111111-1111-4111-8111-111111111111', 'apple', 'vella.premium.yearly',
  'direct-duplicate', true, 'premium_individual', now() + interval '14 days',
  true, 'ios', 'Production', 'trial'
);
select * from faith_harbor.sync_iap_entitlement(
  '11111111-1111-4111-8111-111111111111', 'google', 'vella.premium.yearly',
  'paid-first', true, 'premium_individual', now() + interval '1 year',
  true, 'android', 'production', 'paid'
);
select * from faith_harbor.sync_iap_entitlement(
  '11111111-1111-4111-8111-111111111111', 'google', 'vella.premium.yearly',
  'paid-first', true, 'premium_individual', now() + interval '14 days',
  true, 'android', 'Production', 'trial'
);

-- Unknown phase establishes access without marketing truth. It also provides
-- webhook fixtures with production, test, inactive, and unsupported variants.
select * from faith_harbor.sync_iap_entitlement(
  '11111111-1111-4111-8111-111111111111', 'google', 'vella.premium.yearly',
  'webhook', true, 'premium_individual', now() + interval '14 days',
  true, 'android', 'Production', null
);
select * from faith_harbor.sync_iap_entitlement(
  '11111111-1111-4111-8111-111111111111', 'google', 'vella.premium.monthly',
  'webhook-inactive', true, 'premium_individual', now() + interval '1 month',
  true, 'android', 'Production', null
);
select * from faith_harbor.sync_iap_entitlement(
  '11111111-1111-4111-8111-111111111111', 'google', 'vella.premium.monthly',
  'webhook-test', true, 'premium_individual', now() + interval '1 month',
  true, 'android', 'Test', null
);
select * from faith_harbor.sync_iap_entitlement(
  '11111111-1111-4111-8111-111111111111', 'apple', 'vella.premium.family.yearly',
  'unsupported', true, 'premium_family', now() + interval '1 year',
  true, 'ios', 'Production', 'paid'
);

select * from faith_harbor.apply_iap_subscription_state(
  'google', 'webhook', true, now() + interval '14 days', '2026-08-01', true, 'trial'
);
select * from faith_harbor.apply_iap_subscription_state(
  'google', 'webhook', true, now() + interval '14 days', '2026-08-01', true, 'trial'
);
select * from faith_harbor.apply_iap_subscription_state(
  'google', 'webhook', true, now() + interval '1 year', '2026-08-15', true, 'paid'
);
create table faith_harbor.task3_stale_result as
select * from faith_harbor.apply_iap_subscription_state(
  'google', 'webhook', true, now() + interval '14 days', '2026-07-01', true, 'trial'
);
select * from faith_harbor.apply_iap_subscription_state(
  'google', 'webhook-inactive', false, now() - interval '1 day', '2026-08-15', false, 'paid'
);
select * from faith_harbor.apply_iap_subscription_state(
  'google', 'webhook-test', true, now() + interval '1 month', '2026-08-15', true, 'paid'
);
create table faith_harbor.task3_unlinked_result as
select * from faith_harbor.apply_iap_subscription_state(
  'google', 'not-linked', true, now() + interval '1 month', '2026-08-15', true, 'paid'
);

-- Claim rows and retention boundary rows use synthetic subscription IDs by
-- design: the historical table deliberately has no subscription foreign key.
insert into faith_harbor.subscription_marketing_transitions (
  user_id, subscription_id, provider, plan, phase, environment, occurred_at
) values
  ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'apple', 'yearly', 'trial', 'production', now() - interval '2 days'),
  ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
   'apple', 'yearly', 'paid', 'production', now() - interval '1 day'),
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
   'apple', 'monthly', 'trial', 'production', date_trunc('day', now()) - interval '400 days' + interval '12 hours'),
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
   'apple', 'monthly', 'trial', 'production', date_trunc('day', now()) - interval '401 days' + interval '12 hours');

select faith_harbor.purge_expired_subscription_marketing_transitions(50000);

-- Bounded purging removes no more than the requested batch size and can then
-- drain the remaining eligible row without touching the day-400 boundary.
insert into faith_harbor.subscription_marketing_transitions (
  user_id, subscription_id, provider, plan, phase, environment, occurred_at
) values
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
   'apple', 'monthly', 'trial', 'production', date_trunc('day', now()) - interval '402 days'),
  ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
   'apple', 'monthly', 'trial', 'production', date_trunc('day', now()) - interval '403 days');

do $$
begin
  if faith_harbor.purge_expired_subscription_marketing_transitions(1) <> 1 then
    raise exception 'p_limit=1 did not delete exactly one transition';
  end if;
  if (
    select count(*)
    from faith_harbor.subscription_marketing_transitions
    where subscription_id in (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'
    )
  ) <> 1 then
    raise exception 'bounded purge did not leave exactly one eligible transition';
  end if;
  if faith_harbor.purge_expired_subscription_marketing_transitions(50000) <> 1 then
    raise exception 'bounded purge did not clear the remaining eligible transition';
  end if;
end;
$$;
SQL

# Concurrent direct deliveries serialize on the existing subscription identity
# and still create only one phase row.
task3_psql >/dev/null <<'SQL' &
begin;
select * from faith_harbor.sync_iap_entitlement(
  '11111111-1111-4111-8111-111111111111', 'google', 'vella.premium.yearly',
  'concurrent-direct', true, 'premium_individual', now() + interval '14 days',
  true, 'android', 'Production', 'trial'
);
select pg_advisory_xact_lock(73001);
select pg_sleep(2);
commit;
SQL
DIRECT_LOCK_PID=$!
wait_for_advisory_lock 73001
task3_psql >/dev/null <<'SQL'
select * from faith_harbor.sync_iap_entitlement(
  '11111111-1111-4111-8111-111111111111', 'google', 'vella.premium.yearly',
  'concurrent-direct', true, 'premium_individual', now() + interval '14 days',
  true, 'android', 'Production', 'trial'
);
SQL
wait "$DIRECT_LOCK_PID"

# Concurrent deliveries from different users preserve the first owner and
# classify the losing delivery without creating a second transition.
task3_psql >/dev/null <<'SQL' &
begin;
select * from faith_harbor.sync_iap_entitlement(
  '11111111-1111-4111-8111-111111111111', 'google', 'vella.premium.yearly',
  'cross-user-race', true, 'premium_individual', now() + interval '14 days',
  true, 'android', 'Production', 'trial'
);
select pg_advisory_xact_lock(73003);
select pg_sleep(2);
commit;
SQL
CROSS_USER_LOCK_PID=$!
wait_for_advisory_lock 73003
task3_psql >/dev/null <<'SQL'
create table faith_harbor.task3_cross_user_result as
select * from faith_harbor.sync_iap_entitlement(
  '22222222-2222-4222-8222-222222222222', 'google', 'vella.premium.yearly',
  'cross-user-race', true, 'premium_individual', now() + interval '14 days',
  true, 'android', 'Production', 'trial'
);
SQL
wait "$CROSS_USER_LOCK_PID"

# Lock only the oldest claim candidate in another transaction. SKIP LOCKED must
# return no row and must not consume the newer transition.
task3_psql >/dev/null <<'SQL' &
begin;
select transition_id
from faith_harbor.subscription_marketing_transitions
where user_id = '22222222-2222-4222-8222-222222222222'
  and delivered_at is null
order by occurred_at, created_at, transition_id
limit 1
for update;
select pg_advisory_xact_lock(73002);
select pg_sleep(2);
commit;
SQL
CLAIM_LOCK_PID=$!
wait_for_advisory_lock 73002
LOCKED_CLAIM_COUNT=$(task3_psql -Atc "select count(*) from faith_harbor.claim_subscription_marketing_transition('22222222-2222-4222-8222-222222222222')")
[[ "$LOCKED_CLAIM_COUNT" == "0" ]]
wait "$CLAIM_LOCK_PID"

task3_psql >/dev/null <<'SQL'
do $$
declare
  direct_id uuid;
  webhook_id uuid;
begin
  select id into direct_id from faith_harbor.subscriptions where store_transaction_id = 'direct-duplicate';
  if (select count(*) from faith_harbor.subscription_marketing_transitions where subscription_id = direct_id) <> 1 then
    raise exception 'direct duplicate transition invariant failed';
  end if;
  select id into direct_id from faith_harbor.subscriptions where store_transaction_id = 'concurrent-direct';
  if (select count(*) from faith_harbor.subscription_marketing_transitions where subscription_id = direct_id) <> 1 then
    raise exception 'concurrent direct transition invariant failed';
  end if;
  select id into direct_id from faith_harbor.subscriptions where store_transaction_id = 'cross-user-race';
  if (select user_id from faith_harbor.subscriptions where id = direct_id) <>
       '11111111-1111-4111-8111-111111111111'::uuid
     or not (select linked_to_other_account from faith_harbor.task3_cross_user_result)
     or (select subscription_id from faith_harbor.task3_cross_user_result) is not null
     or (select count(*) from faith_harbor.subscription_marketing_transitions where subscription_id = direct_id) <> 1 then
    raise exception 'cross-user ownership race invariant failed';
  end if;
  select id into direct_id from faith_harbor.subscriptions where store_transaction_id = 'paid-first';
  if (select array_agg(phase order by phase) from faith_harbor.subscription_marketing_transitions where subscription_id = direct_id) <> array['paid']::text[] then
    raise exception 'late direct trial was inserted after paid';
  end if;
  if exists (
    select 1 from faith_harbor.subscription_marketing_transitions as t
    join faith_harbor.subscriptions as s on s.id = t.subscription_id
    where s.store_transaction_id in ('webhook-inactive', 'webhook-test', 'unsupported')
  ) then
    raise exception 'inactive, nonproduction, or unsupported transition inserted';
  end if;

  select id into webhook_id from faith_harbor.subscriptions where store_transaction_id = 'webhook';
  if (select count(*) from faith_harbor.subscription_marketing_transitions where subscription_id = webhook_id) <> 2 then
    raise exception 'webhook trial/paid or duplicate invariant failed';
  end if;
  if not (select stale and not updated from faith_harbor.task3_stale_result) then
    raise exception 'stale webhook classification failed';
  end if;
  if not (select not updated and not stale and subscription_id is null from faith_harbor.task3_unlinked_result) then
    raise exception 'unlinked webhook classification failed';
  end if;

  if exists (
    select 1 from faith_harbor.subscription_marketing_transitions
    where user_id = '22222222-2222-4222-8222-222222222222' and claimed_at is not null
  ) then
    raise exception 'locked oldest claim skipped to a newer transition';
  end if;
  if not exists (
    select 1 from faith_harbor.subscription_marketing_transitions
    where subscription_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
  ) or exists (
    select 1 from faith_harbor.subscription_marketing_transitions
    where subscription_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
  ) then
    raise exception 'day-400/day-401 purge boundary failed';
  end if;

  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'faith_harbor' and p.proname = 'sync_iap_entitlement' and p.pronargs = 11) <> 1 then
    raise exception 'sync signature count failed';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'faith_harbor' and p.proname = 'apply_iap_subscription_state' and p.pronargs = 7) <> 1 then
    raise exception 'seven-argument apply signature count failed';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'faith_harbor' and p.proname = 'apply_iap_subscription_state' and p.pronargs = 6) then
    raise exception 'six-argument apply signature remains';
  end if;
  if has_table_privilege('anon', 'faith_harbor.subscription_marketing_transitions', 'select')
     or has_table_privilege('authenticated', 'faith_harbor.subscription_marketing_transitions', 'select') then
    raise exception 'client table privilege leaked';
  end if;
  if not (
    select relrowsecurity
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'faith_harbor'
      and c.relname = 'subscription_marketing_transitions'
  ) then
    raise exception 'transition table RLS is not enabled';
  end if;
  if exists (
    select 1
    from pg_constraint as con
    join pg_class as table_class on table_class.oid = con.conrelid
    join pg_namespace as n on n.oid = table_class.relnamespace
    where n.nspname = 'faith_harbor'
      and table_class.relname = 'subscription_marketing_transitions'
      and con.contype = 'f'
      and pg_get_constraintdef(con.oid) like 'FOREIGN KEY (subscription_id)%'
  ) then
    raise exception 'subscription_id unexpectedly has a foreign key';
  end if;
  if not exists (
    select 1
    from pg_constraint as con
    join pg_class as table_class on table_class.oid = con.conrelid
    join pg_namespace as n on n.oid = table_class.relnamespace
    where n.nspname = 'faith_harbor'
      and table_class.relname = 'subscription_marketing_transitions'
      and con.contype = 'u'
      and pg_get_constraintdef(con.oid) = 'UNIQUE (subscription_id, phase)'
  ) then
    raise exception 'subscription/phase uniqueness constraint is missing';
  end if;
  if (
    select count(*)
    from pg_indexes
    where schemaname = 'faith_harbor'
      and indexname in (
        'idx_subscription_marketing_transitions_oldest_undelivered',
        'idx_subscription_marketing_transitions_occurred_phase'
      )
  ) <> 2 then
    raise exception 'required transition indexes are missing';
  end if;
  if has_function_privilege(
       'anon', 'faith_harbor.claim_subscription_marketing_transition(uuid)', 'execute'
     ) or has_function_privilege(
       'authenticated', 'faith_harbor.claim_subscription_marketing_transition(uuid)', 'execute'
     ) or has_function_privilege(
       'anon', 'faith_harbor.ack_subscription_marketing_transition(uuid,uuid)', 'execute'
     ) or has_function_privilege(
       'authenticated', 'faith_harbor.ack_subscription_marketing_transition(uuid,uuid)', 'execute'
     ) or has_function_privilege(
       'anon', 'faith_harbor.purge_expired_subscription_marketing_transitions(integer)', 'execute'
     ) or has_function_privilege(
       'authenticated', 'faith_harbor.purge_expired_subscription_marketing_transitions(integer)', 'execute'
     ) then
    raise exception 'client function EXECUTE privilege leaked';
  end if;
  if not has_function_privilege(
       'service_role', 'faith_harbor.claim_subscription_marketing_transition(uuid)', 'execute'
     ) or not has_function_privilege(
       'service_role', 'faith_harbor.ack_subscription_marketing_transition(uuid,uuid)', 'execute'
     ) or not has_function_privilege(
       'service_role', 'faith_harbor.purge_expired_subscription_marketing_transitions(integer)', 'execute'
     ) then
    raise exception 'service-role function EXECUTE privilege missing';
  end if;
  if (
    select count(*)
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'faith_harbor'
      and p.proname in (
        'claim_subscription_marketing_transition',
        'ack_subscription_marketing_transition',
        'purge_expired_subscription_marketing_transitions'
      )
      and not p.prosecdef
      and p.proconfig @> array['search_path=""']::text[]
  ) <> 3 then
    raise exception 'service-only function security mode or search_path invariant failed';
  end if;
end;
$$;

create temporary table first_claim as
select * from faith_harbor.claim_subscription_marketing_transition(
  '22222222-2222-4222-8222-222222222222'
);
create temporary table blocked_claim as
select * from faith_harbor.claim_subscription_marketing_transition(
  '22222222-2222-4222-8222-222222222222'
);
update faith_harbor.subscription_marketing_transitions
set claimed_at = now() - interval '6 minutes'
where transition_id = (select transition_id from first_claim);
create temporary table reclaimed as
select * from faith_harbor.claim_subscription_marketing_transition(
  '22222222-2222-4222-8222-222222222222'
);

do $$
declare
  claimed_id uuid;
  delivered_once timestamptz;
begin
  if (select count(*) from first_claim) <> 1 or (select count(*) from blocked_claim) <> 0 then
    raise exception 'active lease did not block the oldest transition';
  end if;
  if (select count(*) from reclaimed) <> 1 or
     (select transition_id from reclaimed) <> (select transition_id from first_claim) then
    raise exception 'response-loss reclaim did not renew the same transition';
  end if;
  select transition_id into claimed_id from first_claim;
  if faith_harbor.ack_subscription_marketing_transition(
       '11111111-1111-4111-8111-111111111111', claimed_id
     ) then
    raise exception 'wrong-user ACK succeeded';
  end if;
  if not faith_harbor.ack_subscription_marketing_transition(
       '22222222-2222-4222-8222-222222222222', claimed_id
     ) then
    raise exception 'accepted ACK failed';
  end if;
  select delivered_at into delivered_once
  from faith_harbor.subscription_marketing_transitions where transition_id = claimed_id;
  if not faith_harbor.ack_subscription_marketing_transition(
       '22222222-2222-4222-8222-222222222222', claimed_id
     ) then
    raise exception 'duplicate ACK was not idempotently accepted';
  end if;
  if (select delivered_at from faith_harbor.subscription_marketing_transitions where transition_id = claimed_id) <> delivered_once then
    raise exception 'duplicate ACK changed delivered_at';
  end if;
  if (select count(*) from faith_harbor.claim_subscription_marketing_transition(
        '22222222-2222-4222-8222-222222222222'
      )) <> 1 then
    raise exception 'ACK did not unblock the next transition';
  end if;
end;
$$;

-- A live subscription may be deleted before its retained transition, and Auth
-- deletion clears only the historical user link.
delete from faith_harbor.entitlements
where user_id = '22222222-2222-4222-8222-222222222222';
delete from faith_harbor.subscriptions
where user_id = '22222222-2222-4222-8222-222222222222';
delete from auth.users where id = '22222222-2222-4222-8222-222222222222';
do $$
begin
  if not exists (
    select 1 from faith_harbor.subscription_marketing_transitions
    where subscription_id in (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
    ) and user_id is null
  ) then
    raise exception 'deletion survival or user unlink failed';
  end if;
end;
$$;

select 'subscription_marketing_transitions_integration_ok' as result;
SQL
