-- TASK #23 database tests for pre-start release history and integrity.
-- Run by scripts/test-db.sh against a throwaway local Postgres:
--   stub_schema.sql -> legacy fixtures (this file, part 1) -> migration -> tests (part 2)
-- Every assertion raises on failure; psql runs with ON_ERROR_STOP.

\set ON_ERROR_STOP on
\set QUIET on

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create schema t;
grant usage on schema t to authenticated;

create function t.ok(cond boolean, label text) returns void
language plpgsql as $$
begin
  if cond is not true then
    raise exception 'FAIL: %', label;
  end if;
  raise notice 'ok - %', label;
end $$;

create function t.as_user(uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid)::text, false)
$$;

-- Runs sql as the current role and returns the SQLSTATE it raised ('' if none).
create function t.err(sql text) returns text
language plpgsql as $$
begin
  execute sql;
  return '';
exception when others then
  return sqlstate;
end $$;

grant execute on all functions in schema t to authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures (fixed ids for readability)
-- ---------------------------------------------------------------------------
-- users
--   owner      00000000-0000-0000-0000-0000000000a1
--   supervisor 00000000-0000-0000-0000-0000000000a2 (assigned to P1 by user_id)
--   sup_other  00000000-0000-0000-0000-0000000000a3 (not assigned)
--   installer  00000000-0000-0000-0000-0000000000a4 (assigned via people.user_id)
--   office     00000000-0000-0000-0000-0000000000a5
--   no_role    00000000-0000-0000-0000-0000000000a6 (self-signed-up, no role)

insert into private.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', 'supervisor'),
  ('00000000-0000-0000-0000-0000000000a3', 'supervisor'),
  ('00000000-0000-0000-0000-0000000000a4', 'installer'),
  ('00000000-0000-0000-0000-0000000000a5', 'office');

insert into public.clients (id, legal_name) values
  ('00000000-0000-0000-0000-00000000c001', 'Client Ltd');

insert into public.sites (id, client_id, name, address_line_1, postcode, updated_at) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000c001', 'Unit 1', '1 Road', 'M1 1AA', '2026-10-01 09:00:00+00'),
  ('00000000-0000-0000-0000-00000000f000', '00000000-0000-0000-0000-00000000c001', 'Legacy unit', '2 Road', 'M1 1AB', '2026-09-01 09:00:00.123456+00');

insert into public.technical_systems (id, code, revision, status, updated_at) values
  ('00000000-0000-0000-0000-00000000e001', 'RS-EP', 1, 'approved', '2026-09-20 10:00:00+00');

insert into public.projects (id, reference, title, status, client_id, site_id, system_id,
                             area_m2, programme_start, programme_end, scope_summary) values
  ('00000000-0000-0000-0000-000000000001', 'RS-001', 'Ready job', 'won',
   '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000f001',
   '00000000-0000-0000-0000-00000000e001', 420.00, '2026-10-20', '2026-10-24', 'Epoxy floor'),
  ('00000000-0000-0000-0000-000000000000', 'RS-000', 'Legacy released job', 'prestart',
   '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000f000',
   '00000000-0000-0000-0000-00000000e001', 150, '2026-10-10', '2026-10-12', 'Legacy scope');

insert into public.people (id, full_name, user_id) values
  ('00000000-0000-0000-0000-00000000b004', 'Installer', '00000000-0000-0000-0000-0000000000a4'),
  ('00000000-0000-0000-0000-00000000b009', 'Subbie without login', null);

insert into public.project_assignments (id, project_id, person_id, user_id, assignment_role, starts_on, ends_on) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-000000000001', null,
   '00000000-0000-0000-0000-0000000000a2', 'supervisor', '2026-10-20', '2026-10-24'),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-00000000b004', null, 'installer', '2026-10-20', '2026-10-24'),
  ('00000000-0000-0000-0000-00000000d000', '00000000-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-00000000b004', '00000000-0000-0000-0000-0000000000a4', 'installer', '2026-10-10', null);

insert into public.surveys (id, project_id, release_status, technical_outcome, updated_at) values
  ('00000000-0000-0000-0000-00000000a501', '00000000-0000-0000-0000-000000000001', 'released', 'suitable', '2026-10-02 08:00:00+00'),
  ('00000000-0000-0000-0000-00000000a500', '00000000-0000-0000-0000-000000000000', 'released', 'suitable', '2026-09-02 08:00:00.5+00');

insert into public.rams_documents (id, project_id, version, status, updated_at) values
  ('00000000-0000-0000-0000-00000000ab01', '00000000-0000-0000-0000-000000000001', 1, 'approved', '2026-10-03 08:00:00+00'),
  ('00000000-0000-0000-0000-00000000ab00', '00000000-0000-0000-0000-000000000000', 1, 'approved', '2026-09-03 08:00:00+00');

-- Legacy release row exactly as the pre-TASK #23 app wrote it (JS JSON.stringify
-- crew fingerprint; PostgREST-format timestamps).
insert into public.prestart_releases (
  project_id, status, release_note, released_by, released_at,
  survey_id, survey_updated_at, system_id, system_updated_at,
  rams_id, rams_updated_at, site_id, site_updated_at,
  programme_start, programme_end, area_m2, scope_summary, crew_count, crew_fingerprint
) values (
  '00000000-0000-0000-0000-000000000000', 'released', 'legacy', '00000000-0000-0000-0000-0000000000a1', '2026-09-05 12:00:00+00',
  '00000000-0000-0000-0000-00000000a500', '2026-09-02T08:00:00.5+00:00',
  '00000000-0000-0000-0000-00000000e001', '2026-09-20T10:00:00+00:00',
  '00000000-0000-0000-0000-00000000ab00', '2026-09-03T08:00:00+00:00',
  '00000000-0000-0000-0000-00000000f000', '2026-09-01T09:00:00.123456+00:00',
  '2026-10-10', '2026-10-12', 150, 'Legacy scope', 1,
  '[{"id":"00000000-0000-0000-0000-00000000d000","user_id":"00000000-0000-0000-0000-0000000000a4","person_id":"00000000-0000-0000-0000-00000000b004","assignment_role":"installer","starts_on":"2026-10-10","ends_on":null}]'
);

-- ---------------------------------------------------------------------------
-- Apply the migration under test
-- ---------------------------------------------------------------------------
\i :migration

\set QUIET off

-- Helper views over the release history (superuser context).
create view t.releases as
  select id, project_id, status, released_by, superseded_by, withdrawn_by, snapshot
  from public.prestart_releases;
grant select on t.releases to authenticated;

create function t.changed(p uuid) returns text[]
language sql security definer as $$
  select coalesce(array_agg(k order by k), array[]::text[])
  from public.prestart_releases r,
       jsonb_each(public.prestart_current_inputs(p) -> 'snapshot') cur(k, v)
  where r.project_id = p and r.status = 'released'
    and (r.snapshot -> k) is distinct from v
$$;
grant execute on function t.changed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Migration / backfill
-- ---------------------------------------------------------------------------
select t.ok(
  (select count(*) = 1 from public.prestart_releases
    where project_id = '00000000-0000-0000-0000-000000000000' and status = 'released'),
  'migration keeps the legacy active release');
select t.ok(
  t.changed('00000000-0000-0000-0000-000000000000') = array[]::text[],
  'backfilled legacy snapshot matches live inputs (legacy release still current)');

-- ---------------------------------------------------------------------------
-- 11. Unauthorised roles cannot release (RLS + guard)
-- ---------------------------------------------------------------------------
set role authenticated;

select t.as_user('00000000-0000-0000-0000-0000000000a4');
select t.ok(t.err($q$insert into public.prestart_releases (project_id, status)
  values ('00000000-0000-0000-0000-000000000001', 'released')$q$) = '42501',
  '11a installer cannot release');

select t.as_user('00000000-0000-0000-0000-0000000000a5');
select t.ok(t.err($q$insert into public.prestart_releases (project_id, status)
  values ('00000000-0000-0000-0000-000000000001', 'released')$q$) = '42501',
  '11b office cannot release');

select t.as_user('00000000-0000-0000-0000-0000000000a3');
select t.ok(t.err($q$insert into public.prestart_releases (project_id, status)
  values ('00000000-0000-0000-0000-000000000001', 'released')$q$) = '42501',
  '11c unassigned supervisor cannot release');
select t.ok(t.err($q$select public.prestart_current_inputs('00000000-0000-0000-0000-000000000001')$q$) = '42501',
  '11d unassigned supervisor cannot read release inputs');

select t.as_user('00000000-0000-0000-0000-0000000000a6');
select t.ok(t.err($q$insert into public.prestart_releases (project_id, status)
  values ('00000000-0000-0000-0000-000000000001', 'released')$q$) = '42501',
  '11e user with no role cannot release');

reset role;

-- ---------------------------------------------------------------------------
-- 12a. Direct insert is rejected while readiness checks fail
-- ---------------------------------------------------------------------------
update public.rams_documents set status = 'draft' where id = '00000000-0000-0000-0000-00000000ab01';

set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.ok(t.err($q$insert into public.prestart_releases (project_id, status)
  values ('00000000-0000-0000-0000-000000000001', 'released')$q$) = 'P0001',
  '12a owner cannot insert a release while RAMS is not approved');
reset role;

update public.rams_documents set status = 'approved' where id = '00000000-0000-0000-0000-00000000ab01';

-- ---------------------------------------------------------------------------
-- 1. Normal first release (forged values are ignored)
-- ---------------------------------------------------------------------------
set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000a2');
insert into public.prestart_releases (project_id, status, release_note, released_by, released_at, snapshot, crew_count)
values ('00000000-0000-0000-0000-000000000001', 'released', 'first release',
        '00000000-0000-0000-0000-0000000000a1', '2020-01-01', '{"forged": true}', 99);
reset role;

select t.ok((select count(*) = 1 from t.releases
  where project_id = '00000000-0000-0000-0000-000000000001' and status = 'released'),
  '1a first release is active');
select t.ok((select released_by = '00000000-0000-0000-0000-0000000000a2' from t.releases
  where project_id = '00000000-0000-0000-0000-000000000001' and status = 'released'),
  '1b released_by is the caller, not the forged value');
select t.ok((select snapshot ? 'crew_fingerprint' and not snapshot ? 'forged'
              and (snapshot ->> 'crew_count')::int = 2 from t.releases
  where project_id = '00000000-0000-0000-0000-000000000001' and status = 'released'),
  '1c snapshot computed by the database, forged snapshot ignored');
select t.ok((select status = 'prestart' from public.projects
  where id = '00000000-0000-0000-0000-000000000001'),
  '1d won project moves to prestart on first release');

-- ---------------------------------------------------------------------------
-- 2. Unchanged inputs keep the release current
-- ---------------------------------------------------------------------------
update public.projects set next_action = 'Call client' where id = '00000000-0000-0000-0000-000000000001';
select t.ok(t.changed('00000000-0000-0000-0000-000000000001') = array[]::text[],
  '2 unchanged material inputs keep the release current');

-- ---------------------------------------------------------------------------
-- 3. Crew change makes the release stale
-- ---------------------------------------------------------------------------
insert into public.project_assignments (id, project_id, person_id, assignment_role, starts_on, ends_on)
values ('00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-00000000b009', 'installer', '2026-10-21', '2026-10-24');
select t.ok(t.changed('00000000-0000-0000-0000-000000000001') = array['crew_count', 'crew_fingerprint'],
  '3a adding crew makes the release stale (crew)');

delete from public.project_assignments where id = '00000000-0000-0000-0000-00000000d003';
select t.ok(t.changed('00000000-0000-0000-0000-000000000001') = array[]::text[],
  '3b reverting the crew restores the original snapshot');

update public.project_assignments set ends_on = '2026-10-25' where id = '00000000-0000-0000-0000-00000000d002';
select t.ok(t.changed('00000000-0000-0000-0000-000000000001') = array['crew_fingerprint'],
  '3c changing an assignment''s dates makes the release stale');

-- ---------------------------------------------------------------------------
-- 7 + 8. Stale release can be re-released; old release stays in history
-- ---------------------------------------------------------------------------
set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000a2');
insert into public.prestart_releases (project_id, status, release_note)
values ('00000000-0000-0000-0000-000000000001', 'released', 'crew change');
reset role;

select t.ok(t.changed('00000000-0000-0000-0000-000000000001') = array[]::text[],
  '7 re-release makes the new release current');
select t.ok((select count(*) = 2 from t.releases
  where project_id = '00000000-0000-0000-0000-000000000001'),
  '8a both releases are kept');
select t.ok((select count(*) = 1 from t.releases
  where project_id = '00000000-0000-0000-0000-000000000001' and status = 'released'),
  '8b exactly one active release');
select t.ok((select old.superseded_by = cur.id
  from t.releases old, t.releases cur
  where old.project_id = '00000000-0000-0000-0000-000000000001' and old.status = 'superseded'
    and cur.project_id = old.project_id and cur.status = 'released'),
  '8c previous release is superseded by the new one');
select t.ok((select (snapshot ->> 'crew_fingerprint') is distinct from (
    select snapshot ->> 'crew_fingerprint' from t.releases
    where project_id = '00000000-0000-0000-0000-000000000001' and status = 'released')
  from t.releases where project_id = '00000000-0000-0000-0000-000000000001' and status = 'superseded'),
  '8d superseded release keeps its original snapshot');

-- ---------------------------------------------------------------------------
-- 4. Programme / scope / area / site / survey changes make the release stale
-- ---------------------------------------------------------------------------
update public.projects set programme_end = '2026-10-27' where id = '00000000-0000-0000-0000-000000000001';
select t.ok(t.changed('00000000-0000-0000-0000-000000000001') = array['programme_end'],
  '4a programme change makes the release stale');
update public.projects set programme_end = '2026-10-24' where id = '00000000-0000-0000-0000-000000000001';

update public.projects set area_m2 = 420 where id = '00000000-0000-0000-0000-000000000001';
select t.ok(t.changed('00000000-0000-0000-0000-000000000001') = array[]::text[],
  '4b numerically identical area (420 vs 420.00) is not a change');
update public.projects set area_m2 = 450, scope_summary = 'Epoxy floor + coving'
  where id = '00000000-0000-0000-0000-000000000001';
select t.ok(t.changed('00000000-0000-0000-0000-000000000001') = array['area_m2', 'scope_summary'],
  '4c area and scope changes make the release stale');
update public.projects set area_m2 = 420, scope_summary = 'Epoxy floor'
  where id = '00000000-0000-0000-0000-000000000001';

update public.sites set updated_at = now() where id = '00000000-0000-0000-0000-00000000f001';
update public.surveys set updated_at = now() where id = '00000000-0000-0000-0000-00000000a501';
select t.ok(t.changed('00000000-0000-0000-0000-000000000001') = array['site_updated_at', 'survey_updated_at'],
  '4d site and survey record changes make the release stale');

-- ---------------------------------------------------------------------------
-- 5. RAMS revision makes the release stale
-- ---------------------------------------------------------------------------
update public.rams_documents set status = 'superseded', updated_at = now()
  where id = '00000000-0000-0000-0000-00000000ab01';
insert into public.rams_documents (id, project_id, version, status)
values ('00000000-0000-0000-0000-00000000ab02', '00000000-0000-0000-0000-000000000001', 2, 'approved');
select t.ok(t.changed('00000000-0000-0000-0000-000000000001') @> array['rams_id', 'rams_updated_at'],
  '5 new approved RAMS revision makes the release stale');

-- ---------------------------------------------------------------------------
-- 6. Technical system revision makes the release stale; retired revision blocks
-- ---------------------------------------------------------------------------
insert into public.technical_systems (id, code, revision, status)
values ('00000000-0000-0000-0000-00000000e002', 'RS-EP', 2, 'approved');
update public.technical_systems set status = 'retired', updated_at = now()
  where id = '00000000-0000-0000-0000-00000000e001';
select t.ok(t.changed('00000000-0000-0000-0000-000000000001') @> array['system_updated_at'],
  '6a retiring the released system revision makes the release stale');
select t.ok((public.prestart_current_inputs('00000000-0000-0000-0000-000000000001') -> 'blockers') ? 'system',
  '6b retired system blocks re-release until a current revision is assigned');
update public.projects set system_id = '00000000-0000-0000-0000-00000000e002'
  where id = '00000000-0000-0000-0000-000000000001';
select t.ok(t.changed('00000000-0000-0000-0000-000000000001') @> array['system_id', 'system_updated_at'],
  '6c assigning the new system revision is a material change');
select t.ok(jsonb_array_length(public.prestart_current_inputs('00000000-0000-0000-0000-000000000001') -> 'blockers') = 0,
  '6d all readiness checks pass again');

-- ---------------------------------------------------------------------------
-- 9 + 10. Gate 1 progressed / live job: re-release is not deadlocked and
--         completed QA is untouched
-- ---------------------------------------------------------------------------
insert into public.qa_records (project_id, hold_point, status) values
  ('00000000-0000-0000-0000-000000000001', 'Substrate accepted', 'accepted'),
  ('00000000-0000-0000-0000-000000000001', 'Preparation complete', 'accepted'),
  ('00000000-0000-0000-0000-000000000001', 'Repairs and movement joints addressed', 'complete');
update public.projects set status = 'live' where id = '00000000-0000-0000-0000-000000000001';

set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000a2');
select t.ok(t.err($q$insert into public.prestart_releases (project_id, status, release_note)
  values ('00000000-0000-0000-0000-000000000001', 'released', 'live job re-release')$q$) = '',
  '9 re-release succeeds after Gate 1 has been accepted');
reset role;

select t.ok(t.changed('00000000-0000-0000-0000-000000000001') = array[]::text[],
  '10a live job release is current again after re-release');
select t.ok((select count(*) = 3 from public.qa_records
  where project_id = '00000000-0000-0000-0000-000000000001'
    and status in ('accepted', 'complete')),
  '10b completed QA history is untouched by re-release');
select t.ok((select status = 'live' from public.projects
  where id = '00000000-0000-0000-0000-000000000001'),
  '10c live project status is not rewound');
select t.ok((select count(*) = 3 from t.releases
  where project_id = '00000000-0000-0000-0000-000000000001'),
  '10d release history now holds three releases');

-- ---------------------------------------------------------------------------
-- 12b-h. Direct invalid transitions are rejected
-- ---------------------------------------------------------------------------
set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000a1');

select t.ok(t.err($q$update public.prestart_releases set snapshot = '{}'::jsonb
  where project_id = '00000000-0000-0000-0000-000000000001' and status = 'released'$q$) = 'P0001',
  '12b released snapshot cannot be edited');
select t.ok(t.err($q$update public.prestart_releases set released_at = now() - interval '1 day'
  where project_id = '00000000-0000-0000-0000-000000000001' and status = 'released'$q$) = 'P0001',
  '12c release metadata cannot be edited');
select t.ok(t.err($q$update public.prestart_releases set status = 'superseded'
  where project_id = '00000000-0000-0000-0000-000000000001' and status = 'released'$q$) = 'P0001',
  '12d a release cannot be marked superseded directly');
select t.ok(t.err($q$update public.prestart_releases set status = 'released'
  where project_id = '00000000-0000-0000-0000-000000000001' and status = 'superseded'$q$) = 'P0001',
  '12e a superseded release cannot be revived');
select t.ok(t.err($q$insert into public.prestart_releases (project_id, status)
  values ('00000000-0000-0000-0000-000000000001', 'superseded')$q$) = 'P0001',
  '12f history rows cannot be inserted directly');

-- Office and installer updates are filtered out by RLS (0 rows) — no change.
select t.as_user('00000000-0000-0000-0000-0000000000a4');
update public.prestart_releases set status = 'withdrawn'
  where project_id = '00000000-0000-0000-0000-000000000001' and status = 'released';
reset role;
select t.ok((select count(*) = 1 from t.releases
  where project_id = '00000000-0000-0000-0000-000000000001' and status = 'released'),
  '12g installer cannot withdraw a release');

select t.ok(t.err($q$delete from public.prestart_releases
  where project_id = '00000000-0000-0000-0000-000000000001'$q$) = 'P0001',
  '12h release history cannot be deleted (even by the table owner)');

-- Withdraw by the assigned supervisor is allowed and recorded.
set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000a2');
update public.prestart_releases set status = 'withdrawn', withdrawn_reason = 'Client changed scope'
  where project_id = '00000000-0000-0000-0000-000000000001' and status = 'released';
reset role;
select t.ok((select withdrawn_by = '00000000-0000-0000-0000-0000000000a2' from t.releases
  where project_id = '00000000-0000-0000-0000-000000000001' and status = 'withdrawn'),
  '12i supervisor withdrawal is recorded with the caller');
select t.ok((select count(*) = 0 from t.releases
  where project_id = '00000000-0000-0000-0000-000000000001' and status = 'released'),
  '12j withdrawn job has no active release');

set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000a2');
select t.ok(t.err($q$update public.prestart_releases set status = 'released'
  where project_id = '00000000-0000-0000-0000-000000000001' and status = 'withdrawn'$q$) = 'P0001',
  '12k a withdrawn release cannot be reactivated; a new release is required');
select t.ok(t.err($q$insert into public.prestart_releases (project_id, status)
  values ('00000000-0000-0000-0000-000000000001', 'released')$q$) = '',
  '12l a new release can be issued after withdrawal');
reset role;

-- Release is refused once the project is outside won / prestart / live.
update public.projects set status = 'quoted' where id = '00000000-0000-0000-0000-000000000001';
set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.ok(t.err($q$insert into public.prestart_releases (project_id, status)
  values ('00000000-0000-0000-0000-000000000001', 'released')$q$) = 'P0001',
  '12m release refused for a project that is not won / prestart / live');
reset role;

select t.ok((select count(*) >= 3 from public.audit_events
  where table_name = 'prestart_releases' and action = 'INSERT'
    and project_id = '00000000-0000-0000-0000-000000000001'),
  'audit trigger still records release inserts alongside the guard');

\echo 'ALL PRESTART DATABASE TESTS PASSED'
