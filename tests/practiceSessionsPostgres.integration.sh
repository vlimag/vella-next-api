#!/usr/bin/env bash
set -euo pipefail

for prerequisite in initdb pg_ctl psql; do
  if ! command -v "$prerequisite" >/dev/null 2>&1; then
    echo "missing PostgreSQL prerequisite: $prerequisite" >&2
    exit 2
  fi
done

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WORKSPACE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
SESSION_MIGRATIONS=("$WORKSPACE_ROOT"/supabase/migrations/*_practice_session_completion.sql)

if [[ ${#SESSION_MIGRATIONS[@]} -ne 1 || ! -f "${SESSION_MIGRATIONS[0]}" ]]; then
  echo "expected exactly one practice_session_completion migration" >&2
  exit 1
fi

MIGRATION_PATH=${SESSION_MIGRATIONS[0]}
SESSION_PG_ROOT=$(mktemp -d)
SESSION_PG_DATA="$SESSION_PG_ROOT/data"
SESSION_PG_PORT=${SESSION_PG_PORT:-55481}

case "$SESSION_PG_ROOT" in
  /tmp/*|/var/folders/*) ;;
  *) echo "refusing to clean an unsafe temporary PostgreSQL path" >&2; exit 1 ;;
esac

cleanup_session_postgres() {
  pg_ctl -D "$SESSION_PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -r -- "$SESSION_PG_ROOT"
}
trap cleanup_session_postgres EXIT

session_psql() {
  psql -X -v ON_ERROR_STOP=1 -h "$SESSION_PG_ROOT" -p "$SESSION_PG_PORT" postgres "$@"
}

initdb -D "$SESSION_PG_DATA" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$SESSION_PG_DATA" \
  -o "-F -p $SESSION_PG_PORT -k $SESSION_PG_ROOT" -w start >/dev/null

session_psql >/dev/null <<'SQL'
create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;
create schema auth;
create schema faith_harbor;
grant usage on schema faith_harbor to service_role;

create table auth.users (id uuid primary key);
insert into auth.users values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

create table faith_harbor.practice_definitions (
  code text primary key,
  is_active boolean not null
);
insert into faith_harbor.practice_definitions values
  ('guided_prayer', true), ('scripture', true), ('gratitude', true),
  ('silence', true), ('daily_reflection', true), ('act_of_kindness', true);

create table faith_harbor.user_practices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_code text not null references faith_harbor.practice_definitions(code),
  weekly_target smallint not null check (weekly_target between 1 and 7),
  timezone_name text not null,
  preferred_weekdays smallint[] not null default '{}'::smallint[],
  preferred_local_time time,
  status text not null check (status in ('active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, practice_code)
);

create table faith_harbor.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_code text not null references faith_harbor.practice_definitions(code),
  source_type text not null check (source_type in ('direct', 'journey', 'gathering')),
  source_key text not null,
  idempotency_key uuid not null,
  status text not null check (status in ('started', 'completed', 'cancelled')),
  local_day date not null,
  local_week_start date not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (user_id, source_type, source_key)
);

create table faith_harbor.gamification_milestones (
  code text primary key,
  title text not null,
  description text not null,
  metric text not null check (metric in ('streak', 'completed_days', 'completed_journeys')),
  target_value integer not null,
  badge_color text not null,
  is_premium boolean not null,
  category text not null,
  tier text,
  theme_key text,
  asset_key text,
  display_priority integer not null,
  is_shareable boolean not null,
  is_active boolean not null
);

create table faith_harbor.user_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_profile_id uuid,
  milestone_code text not null references faith_harbor.gamification_milestones(code),
  earned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create unique index user_milestones_owner_code
  on faith_harbor.user_milestones(user_id, milestone_code)
  where user_id is not null;

grant select on faith_harbor.practice_definitions to service_role;
grant select, insert, update, delete on faith_harbor.user_practices to service_role;
grant select, insert, update, delete on faith_harbor.practice_sessions to service_role;
grant select, insert, update, delete on faith_harbor.user_milestones to service_role;

insert into faith_harbor.user_practices (
  user_id, practice_code, weekly_target, timezone_name, status
) values
  ('11111111-1111-4111-8111-111111111111', 'guided_prayer', 1, 'Pacific/Kiritimati', 'active'),
  ('11111111-1111-4111-8111-111111111111', 'scripture', 1, 'Pacific/Kiritimati', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'guided_prayer', 1, 'UTC', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'scripture', 1, 'UTC', 'active');

-- Three historical completed rhythms make the next complete week the fourth.
insert into faith_harbor.practice_sessions (
  user_id, practice_code, source_type, source_key, idempotency_key, status,
  local_day, local_week_start, started_at, completed_at
)
select
  '11111111-1111-4111-8111-111111111111', practice_code, 'direct',
  'fixture:' || week_start || ':' || practice_code,
  gen_random_uuid(), 'completed', week_start::date, week_start::date,
  week_start::date::timestamptz, week_start::date::timestamptz
from unnest(array['2025-12-15', '2025-12-22', '2025-12-29']) as week_start
cross join unnest(array['guided_prayer', 'scripture']) as practice_code;

-- A full missing week before owner two's new completion proves return awards.
insert into faith_harbor.practice_sessions (
  user_id, practice_code, source_type, source_key, idempotency_key, status,
  local_day, local_week_start, started_at, completed_at
) values (
  '22222222-2222-4222-8222-222222222222', 'guided_prayer', 'direct',
  'fixture:return-baseline', gen_random_uuid(), 'completed',
  '2025-12-15', '2025-12-15', '2025-12-15T12:00:00Z', '2025-12-15T12:00:00Z'
);
SQL

session_psql --single-transaction -f "$MIGRATION_PATH" >/dev/null

session_psql >/dev/null <<'SQL'
do $verify_acl_and_schema$
begin
  if has_function_privilege('public', 'faith_harbor.start_direct_practice_session(uuid,text,uuid,text,date,date,timestamptz)', 'execute')
    or has_function_privilege('anon', 'faith_harbor.start_direct_practice_session(uuid,text,uuid,text,date,date,timestamptz)', 'execute')
    or has_function_privilege('authenticated', 'faith_harbor.start_direct_practice_session(uuid,text,uuid,text,date,date,timestamptz)', 'execute')
    or not has_function_privilege('service_role', 'faith_harbor.start_direct_practice_session(uuid,text,uuid,text,date,date,timestamptz)', 'execute')
    or has_function_privilege('public', 'faith_harbor.complete_direct_practice_session(uuid,uuid,uuid,timestamptz)', 'execute')
    or has_function_privilege('anon', 'faith_harbor.complete_direct_practice_session(uuid,uuid,uuid,timestamptz)', 'execute')
    or has_function_privilege('authenticated', 'faith_harbor.complete_direct_practice_session(uuid,uuid,uuid,timestamptz)', 'execute')
    or not has_function_privilege('service_role', 'faith_harbor.complete_direct_practice_session(uuid,uuid,uuid,timestamptz)', 'execute') then
    raise exception 'unexpected practice session RPC ACL';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'faith_harbor' and table_name = 'practice_sessions'
      and column_name ~ '(prayer|reflection|gratitude|journal|devotional).*(text|body|content|note)'
  ) then
    raise exception 'content-like practice session column exists';
  end if;
end
$verify_acl_and_schema$;
SQL

# Hold the first transaction open after insertion. The concurrent duplicate
# must wait for the unique owner/key boundary and then replay the same row.
session_psql >/dev/null <<'SQL' &
begin;
set local role service_role;
select faith_harbor.start_direct_practice_session(
  '11111111-1111-4111-8111-111111111111', 'guided_prayer',
  '33333333-3333-4333-8333-333333333333', 'Pacific/Kiritimati',
  '2026-01-02', '2025-12-29', '2026-01-01T10:30:00Z'
);
select pg_sleep(1);
commit;
SQL
START_PID=$!
sleep 0.15
START_REPLAY=$(session_psql -Atc "set role service_role; select faith_harbor.start_direct_practice_session('11111111-1111-4111-8111-111111111111','guided_prayer','33333333-3333-4333-8333-333333333333','Pacific/Kiritimati','2026-01-02','2025-12-29','2026-01-01T10:30:00Z')->>'outcome';")
wait "$START_PID"

if [[ "$START_REPLAY" != *"already_started" ]]; then
  echo "concurrent start did not replay safely" >&2
  exit 1
fi

SESSION_ID=$(session_psql -Atc "select id from faith_harbor.practice_sessions where user_id='11111111-1111-4111-8111-111111111111' and idempotency_key='33333333-3333-4333-8333-333333333333';")

# Complete across the local Monday boundary, again with a held lock and a
# concurrent identical completion request.
session_psql -v session_id="$SESSION_ID" >/dev/null <<'SQL' &
begin;
set local role service_role;
select faith_harbor.complete_direct_practice_session(
  '11111111-1111-4111-8111-111111111111', :'session_id',
  '44444444-4444-4444-8444-444444444444', '2026-01-04T10:30:00Z'
);
select pg_sleep(1);
commit;
SQL
COMPLETE_PID=$!
sleep 0.15
COMPLETE_REPLAY=$(session_psql -Atc "set role service_role; select faith_harbor.complete_direct_practice_session('11111111-1111-4111-8111-111111111111','$SESSION_ID','44444444-4444-4444-8444-444444444444','2026-01-04T10:30:00Z')->>'outcome';")
wait "$COMPLETE_PID"

if [[ "$COMPLETE_REPLAY" != *"already_completed" ]]; then
  echo "concurrent completion did not replay safely" >&2
  exit 1
fi

session_psql >/dev/null <<'SQL'
set role service_role;

do $verify_boundary_and_foreign_owner$
declare
  target_id uuid;
  result jsonb;
begin
  select id into target_id
  from faith_harbor.practice_sessions
  where user_id = '11111111-1111-4111-8111-111111111111'
    and idempotency_key = '33333333-3333-4333-8333-333333333333';

  select faith_harbor.complete_direct_practice_session(
    '22222222-2222-4222-8222-222222222222', target_id,
    '66666666-6666-4666-8666-666666666666', '2026-01-04T10:30:00Z'
  ) into result;
  if result ->> 'outcome' <> 'not_found' then
    raise exception 'foreign session completion was not denied';
  end if;

  if (select local_day from faith_harbor.practice_sessions where id = target_id) <> '2026-01-05'
    or (select local_week_start from faith_harbor.practice_sessions where id = target_id) <> '2026-01-05' then
    raise exception 'completion did not move credit to the completion-local week';
  end if;
end
$verify_boundary_and_foreign_owner$;

do $complete_fourth_week$
declare
  start_result jsonb;
  complete_result jsonb;
begin
  select faith_harbor.start_direct_practice_session(
    '11111111-1111-4111-8111-111111111111', 'scripture',
    '77777777-7777-4777-8777-777777777777', 'Pacific/Kiritimati',
    '2026-01-05', '2026-01-05', '2026-01-04T10:40:00Z'
  ) into start_result;
  select faith_harbor.complete_direct_practice_session(
    '11111111-1111-4111-8111-111111111111', (start_result #>> '{session,id}')::uuid,
    '88888888-8888-4888-8888-888888888888', '2026-01-04T10:45:00Z'
  ) into complete_result;

  if complete_result ->> 'outcome' <> 'completed'
    or complete_result #>> '{weekly_summary,rhythm_met}' <> 'true'
    or not (complete_result -> 'newly_earned_milestones' ? 'rhythm_first_week')
    or not (complete_result -> 'newly_earned_milestones' ? 'rhythm_four_weeks')
    or not (complete_result -> 'newly_earned_milestones' ? 'rhythm_balanced') then
    raise exception 'weekly completion facts or milestones are incorrect: %', complete_result;
  end if;

  select faith_harbor.complete_direct_practice_session(
    '11111111-1111-4111-8111-111111111111', (start_result #>> '{session,id}')::uuid,
    '88888888-8888-4888-8888-888888888888', '2026-01-04T10:45:00Z'
  ) into complete_result;
  if complete_result ->> 'outcome' <> 'already_completed'
    or not (complete_result -> 'newly_earned_milestones' ? 'rhythm_four_weeks') then
    raise exception 'completion replay lost milestone facts';
  end if;
end
$complete_fourth_week$;

do $verify_return_cancel_and_source_dedup$
declare
  start_result jsonb;
  complete_result jsonb;
  cancelled_id uuid;
  conflict_session_id uuid;
  clock_session_id uuid;
begin
  select faith_harbor.start_direct_practice_session(
    '22222222-2222-4222-8222-222222222222', 'guided_prayer',
    '99999999-9999-4999-8999-999999999999', 'UTC',
    '2026-01-05', '2026-01-05', '2026-01-05T12:00:00Z'
  ) into start_result;
  select faith_harbor.complete_direct_practice_session(
    '22222222-2222-4222-8222-222222222222', (start_result #>> '{session,id}')::uuid,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-01-05T12:05:00Z'
  ) into complete_result;
  if not (complete_result -> 'newly_earned_milestones' ? 'rhythm_return') then
    raise exception 'return after a full gap did not award once';
  end if;

  insert into faith_harbor.practice_sessions (
    user_id, practice_code, source_type, source_key, idempotency_key, status,
    timezone_name, local_day, local_week_start, started_at
  ) values (
    '22222222-2222-4222-8222-222222222222', 'scripture', 'direct',
    'direct:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cancelled', 'UTC',
    '2026-01-05', '2026-01-05', '2026-01-05T12:10:00Z'
  ) returning id into cancelled_id;
  select faith_harbor.complete_direct_practice_session(
    '22222222-2222-4222-8222-222222222222', cancelled_id,
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '2026-01-05T12:15:00Z'
  ) into complete_result;
  if complete_result ->> 'outcome' <> 'cancelled' then
    raise exception 'cancelled session was completed';
  end if;

  select faith_harbor.start_direct_practice_session(
    '22222222-2222-4222-8222-222222222222', 'scripture',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'UTC',
    '2026-01-05', '2026-01-05', '2026-01-05T13:00:00Z'
  ) #>> '{session,id}' into conflict_session_id;
  select faith_harbor.complete_direct_practice_session(
    '22222222-2222-4222-8222-222222222222', conflict_session_id,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-01-05T13:05:00Z'
  ) into complete_result;
  if complete_result ->> 'outcome' <> 'idempotency_conflict' then
    raise exception 'completion key reused across sessions was not rejected';
  end if;

  select faith_harbor.start_direct_practice_session(
    '22222222-2222-4222-8222-222222222222', 'scripture',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'UTC',
    '2026-01-05', '2026-01-05', '2026-01-05T14:00:00Z'
  ) #>> '{session,id}' into clock_session_id;
  select faith_harbor.complete_direct_practice_session(
    '22222222-2222-4222-8222-222222222222', clock_session_id,
    'ffffffff-ffff-4fff-8fff-ffffffffffff', '2026-01-05T13:59:59Z'
  ) into complete_result;
  if complete_result ->> 'outcome' <> 'invalid_request'
    or (select status from faith_harbor.practice_sessions where id = clock_session_id) <> 'started' then
    raise exception 'completion before session start was accepted';
  end if;

  if (select count(*) from faith_harbor.practice_sessions
      where user_id = '11111111-1111-4111-8111-111111111111'
        and source_type = 'direct'
        and source_key = 'direct:33333333-3333-4333-8333-333333333333') <> 1 then
    raise exception 'direct source deduplication failed';
  end if;
end
$verify_return_cancel_and_source_dedup$;

reset role;

do $verify_no_duplicate_awards$
begin
  if exists (
    select user_id, milestone_code
    from faith_harbor.user_milestones
    group by user_id, milestone_code
    having count(*) > 1
  ) then
    raise exception 'duplicate milestone award exists';
  end if;
end
$verify_no_duplicate_awards$;
SQL

echo "practice session PostgreSQL integration passed"
