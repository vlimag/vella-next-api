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
MIGRATIONS=("$WORKSPACE_ROOT"/supabase/migrations/*_journey_completion_v2.sql)

if [[ ${#MIGRATIONS[@]} -ne 1 || ! -f "${MIGRATIONS[0]}" ]]; then
  echo "expected exactly one journey completion v2 migration" >&2
  exit 1
fi

MIGRATION_PATH=${MIGRATIONS[0]}
PG_ROOT=$(mktemp -d)
PG_DATA="$PG_ROOT/data"
PG_PORT=${JOURNEY_COMPLETION_PG_PORT:-55479}

case "$PG_ROOT" in
  /tmp/*|/var/folders/*) ;;
  *) echo "refusing to clean an unsafe temporary PostgreSQL path" >&2; exit 1 ;;
esac

cleanup_postgres() {
  pg_ctl -D "$PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -r -- "$PG_ROOT"
}
trap cleanup_postgres EXIT

journey_psql() {
  psql -X -v ON_ERROR_STOP=1 -h "$PG_ROOT" -p "$PG_PORT" postgres "$@"
}

initdb -D "$PG_DATA" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -o "-F -p $PG_PORT -k $PG_ROOT" -w start >/dev/null

journey_psql >/dev/null <<'SQL'
create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;
create schema auth;
create schema faith_harbor;
grant usage on schema faith_harbor to anon, authenticated, service_role;

create table auth.users (id uuid primary key);
create table faith_harbor.journey_templates (
  id uuid primary key,
  duration_days integer not null
);
create table faith_harbor.user_journeys (
  id uuid primary key,
  user_id uuid references auth.users(id),
  anonymous_profile_id uuid,
  template_id uuid not null references faith_harbor.journey_templates(id),
  status text not null default 'active',
  current_day integer not null default 1,
  streak_count integer not null default 0,
  best_streak integer not null default 0,
  total_completed_days integer not null default 0,
  consistency_score numeric(5,2) not null default 0,
  last_completed_on date,
  completed_at timestamptz,
  timezone_name text not null default 'UTC',
  updated_at timestamptz not null default now()
);
create table faith_harbor.user_journey_day_assignments (
  user_journey_id uuid not null references faith_harbor.user_journeys(id),
  day_number integer not null,
  steps jsonb not null default '[]',
  unique (user_journey_id, day_number)
);
create table faith_harbor.user_journey_daily_sessions (
  id uuid primary key default gen_random_uuid(),
  user_journey_id uuid not null references faith_harbor.user_journeys(id),
  day_number integer not null,
  session_date date not null,
  reflection_note text,
  gratitude_note text,
  completed_steps jsonb not null default '[]',
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_journey_id, day_number)
);
create table faith_harbor.practice_definitions (code text primary key);
create table faith_harbor.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  practice_code text not null references faith_harbor.practice_definitions(code),
  source_type text not null,
  source_key text not null,
  idempotency_key uuid not null,
  status text not null,
  local_day date not null,
  local_week_start date not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (user_id, source_type, source_key)
);
create table faith_harbor.gamification_milestones (code text primary key);
create table faith_harbor.user_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  anonymous_profile_id uuid,
  milestone_code text not null references faith_harbor.gamification_milestones(code),
  earned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'
);
create unique index user_milestones_owner_code
  on faith_harbor.user_milestones(user_id, milestone_code) where user_id is not null;

grant select, insert, update, delete on all tables in schema faith_harbor to service_role;
insert into auth.users values
  ('11111111-1111-4111-8111-111111111111'),
  ('99999999-9999-4999-8999-999999999999');
insert into faith_harbor.practice_definitions values ('guided_prayer');
insert into faith_harbor.gamification_milestones values ('streak_3'), ('streak_7'), ('journey_finisher');
insert into faith_harbor.journey_templates values
  ('44444444-4444-4444-8444-444444444444', 2),
  ('55555555-5555-4555-8555-555555555555', 3);
insert into faith_harbor.user_journeys (
  id, user_id, template_id, current_day, streak_count, best_streak,
  total_completed_days, consistency_score, last_completed_on
) values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  '44444444-4444-4444-8444-444444444444',
  2, 2, 2, 1, 50, '2026-08-25'
);
insert into faith_harbor.user_journey_day_assignments values
  ('22222222-2222-4222-8222-222222222222', 2, '[{"stepType":"prayer"}]');
insert into faith_harbor.user_journey_daily_sessions (
  user_journey_id, day_number, session_date, reflection_note, gratitude_note
) values (
  '22222222-2222-4222-8222-222222222222', 1, '2026-08-25',
  'historical private reflection', 'historical private gratitude'
);
SQL

journey_psql --single-transaction -f "$MIGRATION_PATH" >/dev/null

journey_psql >/dev/null <<'SQL'
do $catalog$
begin
  if (select prosecdef from pg_proc where oid = 'faith_harbor.complete_journey_session_v2(uuid,uuid,text,text,text,date,date,uuid,timestamp with time zone)'::regprocedure)
    or (select proconfig from pg_proc where oid = 'faith_harbor.complete_journey_session_v2(uuid,uuid,text,text,text,date,date,uuid,timestamp with time zone)'::regprocedure) <> array['search_path=""']
    or has_function_privilege('public', 'faith_harbor.complete_journey_session_v2(uuid,uuid,text,text,text,date,date,uuid,timestamp with time zone)', 'execute')
    or has_function_privilege('anon', 'faith_harbor.complete_journey_session_v2(uuid,uuid,text,text,text,date,date,uuid,timestamp with time zone)', 'execute')
    or has_function_privilege('authenticated', 'faith_harbor.complete_journey_session_v2(uuid,uuid,text,text,text,date,date,uuid,timestamp with time zone)', 'execute')
    or not has_function_privilege('service_role', 'faith_harbor.complete_journey_session_v2(uuid,uuid,text,text,text,date,date,uuid,timestamp with time zone)', 'execute') then
    raise exception 'unexpected journey completion function security catalog';
  end if;
end
$catalog$;

set role service_role;
select faith_harbor.complete_journey_session_v2(
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'new private reflection', 'new private gratitude', 'UTC',
  '2026-08-26', '2026-08-24', '33333333-3333-4333-8333-333333333333',
  '2026-08-26T12:00:00Z'
);
reset role;

do $behavior$
declare replay jsonb;
declare keyed_replay jsonb;
begin
  if (select total_completed_days from faith_harbor.user_journeys where id = '22222222-2222-4222-8222-222222222222') <> 2
    or (select status from faith_harbor.user_journeys where id = '22222222-2222-4222-8222-222222222222') <> 'completed'
    or (select count(*) from faith_harbor.practice_sessions where user_id = '11111111-1111-4111-8111-111111111111') <> 1
    or (select count(*) from faith_harbor.user_milestones where user_id = '11111111-1111-4111-8111-111111111111' and milestone_code = 'streak_3') <> 1
    or (select count(*) from faith_harbor.user_milestones where user_id = '11111111-1111-4111-8111-111111111111' and milestone_code = 'journey_finisher') <> 1 then
    raise exception 'atomic final-day completion facts are incorrect';
  end if;
  if not exists (
    select 1 from faith_harbor.user_journey_daily_sessions
    where user_journey_id = '22222222-2222-4222-8222-222222222222'
      and day_number = 1
      and reflection_note = 'historical private reflection'
      and gratitude_note = 'historical private gratitude'
  ) then
    raise exception 'historical daily-session privacy fields changed';
  end if;

  set local role service_role;
  replay := faith_harbor.complete_journey_session_v2(
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    null, null, 'UTC', '2026-08-26', '2026-08-24', null,
    '2026-08-26T12:01:00Z'
  );
  reset role;
  if replay ->> 'outcome' <> 'already_completed' then
    raise exception 'old-payload duplicate was not idempotent';
  end if;

  set local role service_role;
  keyed_replay := faith_harbor.complete_journey_session_v2(
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    'replacement private reflection', null, 'UTC',
    '2026-08-27', '2026-08-24', '33333333-3333-4333-8333-333333333333',
    '2026-08-27T12:00:00Z'
  );
  reset role;
  if keyed_replay ->> 'outcome' <> 'already_completed'
    or keyed_replay::text like '%11111111-1111-4111-8111-111111111111%'
    or keyed_replay::text like '%private reflection%'
    or keyed_replay::text like '%private gratitude%' then
    raise exception 'same-key replay was not finite, private, and idempotent';
  end if;
end
$behavior$;
SQL

journey_psql -At -c "
  insert into faith_harbor.user_journeys (id,user_id,template_id)
  values ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555');
  insert into faith_harbor.user_journey_day_assignments values
    ('66666666-6666-4666-8666-666666666666',1,'[]');
" >/dev/null

conflict_result=$(journey_psql -At -c "
  set role service_role;
  select faith_harbor.complete_journey_session_v2(
    '11111111-1111-4111-8111-111111111111',
    '66666666-6666-4666-8666-666666666666',
    null,null,'UTC','2026-08-27','2026-08-24',
    '33333333-3333-4333-8333-333333333333','2026-08-27T11:00:00Z'
  ) ->> 'outcome';
")
if [[ "$conflict_result" != "SET"$'\n'"idempotency_conflict" ]]; then
  echo "provided idempotency key did not enforce its retry boundary" >&2
  exit 1
fi

if [[ $(journey_psql -At -c "select total_completed_days from faith_harbor.user_journeys where id = '66666666-6666-4666-8666-666666666666'") != "0" ]]; then
  echo "idempotency conflict mutated journey progress" >&2
  exit 1
fi

(journey_psql -At -c "set role service_role; select faith_harbor.complete_journey_session_v2('11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666666',null,null,'UTC','2026-08-27','2026-08-24',null,'2026-08-27T12:00:00Z');" >/dev/null) &
first_pid=$!
(journey_psql -At -c "set role service_role; select faith_harbor.complete_journey_session_v2('11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666666',null,null,'UTC','2026-08-27','2026-08-24',null,'2026-08-27T12:00:00Z');" >/dev/null) &
second_pid=$!
wait "$first_pid"
wait "$second_pid"

journey_psql >/dev/null <<'SQL'
do $concurrency$
declare unauthorized jsonb;
begin
  if (select total_completed_days from faith_harbor.user_journeys where id = '66666666-6666-4666-8666-666666666666') <> 1
    or (select count(*) from faith_harbor.user_journey_daily_sessions where user_journey_id = '66666666-6666-4666-8666-666666666666') <> 1
    or (select count(*) from faith_harbor.practice_sessions where source_key = 'journey:66666666-6666-4666-8666-666666666666:day:1') <> 1 then
    raise exception 'simultaneous calls duplicated completion facts';
  end if;

  set local role service_role;
  unauthorized := faith_harbor.complete_journey_session_v2(
    '99999999-9999-4999-8999-999999999999',
    '66666666-6666-4666-8666-666666666666',
    null, null, 'UTC', '2026-08-28', '2026-08-24', null,
    '2026-08-28T12:00:00Z'
  );
  reset role;
  if unauthorized ->> 'outcome' <> 'not_found' then
    raise exception 'ownership boundary exposed another account journey';
  end if;
end
$concurrency$;
SQL

echo "Journey completion v2 PostgreSQL integration passed: ACL ownership retry concurrency privacy atomicity"
