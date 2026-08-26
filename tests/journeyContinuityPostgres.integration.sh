#!/usr/bin/env bash
set -euo pipefail

for prerequisite in initdb pg_ctl psql; do
  command -v "$prerequisite" >/dev/null 2>&1 || { echo "missing PostgreSQL prerequisite: $prerequisite" >&2; exit 2; }
done

PG_ROOT=$(mktemp -d)
PG_DATA="$PG_ROOT/data"
PG_PORT=${JOURNEY_CONTINUITY_PG_PORT:-55480}
case "$PG_ROOT" in /tmp/*|/var/folders/*) ;; *) echo "unsafe temporary PostgreSQL path" >&2; exit 1;; esac
cleanup() { pg_ctl -D "$PG_DATA" -m immediate stop >/dev/null 2>&1 || true; rm -r -- "$PG_ROOT"; }
trap cleanup EXIT
psql_local() { psql -X -v ON_ERROR_STOP=1 -h "$PG_ROOT" -p "$PG_PORT" postgres "$@"; }

initdb -D "$PG_DATA" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -o "-F -p $PG_PORT -k $PG_ROOT" -w start >/dev/null

psql_local >/dev/null <<'SQL'
create extension pgcrypto;
create schema faith_harbor;
create table faith_harbor.journey_templates (id uuid primary key, slug text not null, version integer not null, language_code text not null, title text not null, description text not null, theme_tags text[] not null default '{}');
create table faith_harbor.user_journeys (
  id uuid primary key, user_id uuid not null, template_id uuid not null references faith_harbor.journey_templates,
  status text not null, start_date date not null default current_date, current_day integer not null default 1,
  total_completed_days integer not null default 0, completed_at timestamptz, paused_at timestamptz,
  last_resumed_at timestamptz, timezone_name text not null default 'UTC', source text not null default 'legacy', completion_version integer not null default 1
);
create unique index user_journeys_one_active on faith_harbor.user_journeys(user_id) where status = 'active';
insert into faith_harbor.journey_templates values ('00000000-0000-4000-8000-000000000001','daily-faith-journey',1,'en','Seven Days','Summary',array['hope']);
insert into faith_harbor.user_journeys values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','completed','2026-08-01',7,7,'2026-08-20T00:00:00Z',null,null,'UTC','browse',1),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','completed','2026-08-02',7,7,'2026-08-20T00:00:00Z',null,null,'UTC','browse',1),
 ('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','completed','2026-08-03',7,7,'2026-08-21T00:00:00Z',null,null,'UTC','browse',1),
 ('10000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','completed','2026-08-04',7,7,'2026-08-22T00:00:00Z',null,null,'UTC','browse',1),
 ('10000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','paused','2026-08-05',3,2,null,'2026-08-25T00:00:00Z',null,'UTC','onboarding',1);
SQL

history=$(psql_local -At -c "select string_agg(id::text, ',' order by completed_at desc, id asc) from (select id, completed_at from faith_harbor.user_journeys where user_id='20000000-0000-4000-8000-000000000001' and status='completed' order by completed_at desc,id asc limit 50) rows")
[[ "$history" == "10000000-0000-4000-8000-000000000003,10000000-0000-4000-8000-000000000001,10000000-0000-4000-8000-000000000002" ]] || { echo "history ordering/isolation failed" >&2; exit 1; }
[[ $(psql_local -At -c "select count(*) from (select id from faith_harbor.user_journeys where user_id='20000000-0000-4000-8000-000000000001' and status='completed' order by completed_at desc,id asc limit 1) rows") == 1 ]] || exit 1
[[ $(psql_local -At -c "select count(*) from faith_harbor.user_journeys where user_id='50000000-0000-4000-8000-000000000001' and status='completed'") == 0 ]] || exit 1

psql_local >/dev/null <<'SQL'
do $$ begin
  insert into faith_harbor.user_journeys values ('10000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','active','2026-08-05',1,0,null,null,null,'UTC','browse',1);
  begin
    insert into faith_harbor.user_journeys values ('10000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','active','2026-08-05',1,0,null,null,null,'UTC','browse',1);
    raise exception 'partial active invariant missing';
  exception when unique_violation then null; end;
end $$;
delete from faith_harbor.user_journeys where id = '10000000-0000-4000-8000-000000000006';
SQL

for target in active completed; do
  psql_local -c "update faith_harbor.user_journeys set status='$target', completed_at=case when '$target'='completed' then '2026-08-26T00:00:00Z'::timestamptz else null end where id='10000000-0000-4000-8000-000000000005'" >/dev/null
  [[ $(psql_local -At -c "with attempted as (update faith_harbor.user_journeys set status='active',paused_at=null,last_resumed_at='2026-08-26T01:00:00Z' where id='10000000-0000-4000-8000-000000000005' and user_id='40000000-0000-4000-8000-000000000001' and status='paused' returning id) select count(*) from attempted") == 0 ]] || { echo "conditional race unexpectedly rewound $target" >&2; exit 1; }
  [[ $(psql_local -At -c "select status||':'||current_day||':'||total_completed_days from faith_harbor.user_journeys where id='10000000-0000-4000-8000-000000000005'") == "$target:3:2" ]] || { echo "race mutated $target" >&2; exit 1; }
done

echo "journey continuity PostgreSQL contract passed"
