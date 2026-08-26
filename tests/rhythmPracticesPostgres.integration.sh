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
PRACTICE_MIGRATIONS=("$WORKSPACE_ROOT"/supabase/migrations/*_replace_user_practices.sql)

if [[ ${#PRACTICE_MIGRATIONS[@]} -ne 1 || ! -f "${PRACTICE_MIGRATIONS[0]}" ]]; then
  echo "expected exactly one replace_user_practices migration" >&2
  exit 1
fi

MIGRATION_PATH=${PRACTICE_MIGRATIONS[0]}
PRACTICE_PG_ROOT=$(mktemp -d)
PRACTICE_PG_DATA="$PRACTICE_PG_ROOT/data"
PRACTICE_PG_PORT=${PRACTICE_PG_PORT:-55480}

case "$PRACTICE_PG_ROOT" in
  /tmp/*|/var/folders/*) ;;
  *) echo "refusing to clean an unsafe temporary PostgreSQL path" >&2; exit 1 ;;
esac

cleanup_practice_postgres() {
  pg_ctl -D "$PRACTICE_PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -r -- "$PRACTICE_PG_ROOT"
}
trap cleanup_practice_postgres EXIT

practice_psql() {
  psql -X -v ON_ERROR_STOP=1 -h "$PRACTICE_PG_ROOT" -p "$PRACTICE_PG_PORT" postgres "$@"
}

initdb -D "$PRACTICE_PG_DATA" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$PRACTICE_PG_DATA" \
  -o "-F -p $PRACTICE_PG_PORT -k $PRACTICE_PG_ROOT" -w start >/dev/null

practice_psql >/dev/null <<'SQL'
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
  ('guided_prayer', true),
  ('scripture', true),
  ('gratitude', true),
  ('silence', true),
  ('daily_reflection', true),
  ('act_of_kindness', false);

create table faith_harbor.user_practices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_code text not null references faith_harbor.practice_definitions(code),
  weekly_target smallint not null check (weekly_target between 1 and 7),
  timezone_name text not null,
  status text not null check (status in ('active', 'paused')),
  updated_at timestamptz not null default now(),
  unique (user_id, practice_code)
);

grant select on faith_harbor.practice_definitions to service_role;
grant select, insert, update, delete on faith_harbor.user_practices to service_role;
SQL

practice_psql --single-transaction -f "$MIGRATION_PATH" >/dev/null

practice_psql >/dev/null <<'SQL'
do $verify_acl$
begin
  if has_function_privilege('public', 'faith_harbor.replace_user_practices(uuid,text,jsonb)', 'execute')
    or has_function_privilege('anon', 'faith_harbor.replace_user_practices(uuid,text,jsonb)', 'execute')
    or has_function_privilege('authenticated', 'faith_harbor.replace_user_practices(uuid,text,jsonb)', 'execute')
    or not has_function_privilege('service_role', 'faith_harbor.replace_user_practices(uuid,text,jsonb)', 'execute') then
    raise exception 'unexpected replace_user_practices ACL';
  end if;
end
$verify_acl$;

set role service_role;

select * from faith_harbor.replace_user_practices(
  '11111111-1111-4111-8111-111111111111',
  'America/Sao_Paulo',
  '[{"code":"guided_prayer","weekly_target":2},{"code":"scripture","weekly_target":3}]'::jsonb
);

select * from faith_harbor.replace_user_practices(
  '22222222-2222-4222-8222-222222222222',
  'UTC',
  '[{"code":"gratitude","weekly_target":2},{"code":"silence","weekly_target":1}]'::jsonb
);

do $verify_replace_and_isolation$
begin
  if (select count(*) from faith_harbor.user_practices where user_id = '11111111-1111-4111-8111-111111111111') <> 2
    or (select count(*) from faith_harbor.user_practices where user_id = '22222222-2222-4222-8222-222222222222') <> 2 then
    raise exception 'account practice configuration is not isolated';
  end if;

  perform faith_harbor.replace_user_practices(
    '11111111-1111-4111-8111-111111111111',
    'America/Sao_Paulo',
    '[{"code":"guided_prayer","weekly_target":1},{"code":"scripture","weekly_target":2},{"code":"gratitude","weekly_target":3},{"code":"silence","weekly_target":4}]'::jsonb
  );

  if (select count(*) from faith_harbor.user_practices where user_id = '11111111-1111-4111-8111-111111111111') <> 4
    or (select weekly_target from faith_harbor.user_practices where user_id = '11111111-1111-4111-8111-111111111111' and practice_code = 'guided_prayer') <> 1
    or (select count(*) from faith_harbor.user_practices where user_id = '22222222-2222-4222-8222-222222222222') <> 2 then
    raise exception 'replace did not apply atomically within one owner';
  end if;
end
$verify_replace_and_isolation$;

do $verify_rejections_are_atomic$
declare
  candidate jsonb;
  candidate_timezone text;
  before_rows jsonb;
  after_rows jsonb;
begin
  select jsonb_agg(jsonb_build_object('code', practice_code, 'target', weekly_target) order by practice_code)
    into before_rows
  from faith_harbor.user_practices
  where user_id = '11111111-1111-4111-8111-111111111111';

  for candidate, candidate_timezone in
    select * from (values
      ('[{"code":"guided_prayer","weekly_target":2}]'::jsonb, 'UTC'),
      ('[{"code":"guided_prayer","weekly_target":2},{"code":"guided_prayer","weekly_target":3}]'::jsonb, 'UTC'),
      ('[{"code":"guided_prayer","weekly_target":2},{"code":"act_of_kindness","weekly_target":1}]'::jsonb, 'UTC'),
      ('[{"code":"guided_prayer","weekly_target":2},{"code":"scripture","weekly_target":8}]'::jsonb, 'UTC'),
      ('[{"code":"guided_prayer","weekly_target":2},{"code":"scripture","weekly_target":3}]'::jsonb, 'Mars/Olympus')
    ) as rejected(configuration, timezone_name)
  loop
    begin
      perform faith_harbor.replace_user_practices(
        '11111111-1111-4111-8111-111111111111', candidate_timezone, candidate
      );
      raise exception 'invalid configuration was accepted';
    exception
      when sqlstate '22023' then null;
    end;
  end loop;

  select jsonb_agg(jsonb_build_object('code', practice_code, 'target', weekly_target) order by practice_code)
    into after_rows
  from faith_harbor.user_practices
  where user_id = '11111111-1111-4111-8111-111111111111';

  if after_rows is distinct from before_rows then
    raise exception 'a rejected replacement changed stored configuration';
  end if;
end
$verify_rejections_are_atomic$;

reset role;
SQL

echo "replace_user_practices PostgreSQL integration passed"
