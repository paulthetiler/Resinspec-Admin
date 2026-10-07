-- TASK #22: pre-start release history + database-enforced release integrity.
--
-- Before: one prestart_releases row per project (upserted on project_id),
-- snapshot computed and written by the app, release rules enforced only in
-- Next.js server actions.
--
-- After:
--   * prestart_releases is an append-only history. Each release is a new row.
--     At most one row per project has status 'released' (the active release);
--     earlier releases become 'superseded', reopened ones 'withdrawn'.
--   * The release snapshot is computed by the database at insert time
--     (private.prestart_snapshot) and cannot be supplied or edited by callers.
--   * A release can only be inserted when the database readiness checks pass
--     (private.prestart_blockers) and the caller is Owner, or Supervisor with
--     project access.
--   * Released rows are immutable apart from the supersede / withdraw
--     transitions. Rows cannot be deleted.
--   * public.prestart_current_inputs(project) lets the app compare the active
--     release snapshot with the live inputs using the same canonical format.
--
-- The migration is written defensively because the original prestart_releases
-- DDL is not in source control: it adapts to whichever unique/PK constraint and
-- status check currently exist on project_id / status.

begin;

-- ---------------------------------------------------------------------------
-- 1. Table shape: history rows instead of one row per project
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  has_id boolean;
  has_pk boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'prestart_releases' and column_name = 'id'
  ) into has_id;

  if not has_id then
    alter table public.prestart_releases
      add column id uuid not null default gen_random_uuid();
  end if;

  -- Drop any PRIMARY KEY / UNIQUE constraint that is exactly (project_id).
  for r in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.prestart_releases'::regclass
      and con.contype in ('p', 'u')
      and con.conkey = array[(
        select attnum from pg_attribute
        where attrelid = 'public.prestart_releases'::regclass and attname = 'project_id'
      )]::int2[]
  loop
    execute format('alter table public.prestart_releases drop constraint %I', r.conname);
  end loop;

  -- Drop any standalone unique index that is exactly (project_id).
  for r in
    select i.relname as indexname
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    where x.indrelid = 'public.prestart_releases'::regclass
      and x.indisunique
      and x.indpred is null
      and x.indkey::int2[] = array[(
        select attnum from pg_attribute
        where attrelid = 'public.prestart_releases'::regclass and attname = 'project_id'
      )]::int2[]
  loop
    execute format('drop index public.%I', r.indexname);
  end loop;

  select exists (
    select 1 from pg_constraint
    where conrelid = 'public.prestart_releases'::regclass and contype = 'p'
  ) into has_pk;

  if not has_pk then
    alter table public.prestart_releases add primary key (id);
  end if;

  -- Replace any CHECK constraint on status with the history-aware one.
  for r in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.prestart_releases'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.prestart_releases drop constraint %I', r.conname);
  end loop;
end
$$;

-- If status is an enum, convert it to text so the new states can be used.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'prestart_releases'
      and column_name = 'status' and data_type = 'USER-DEFINED'
  ) then
    alter table public.prestart_releases alter column status drop default;
    alter table public.prestart_releases alter column status type text using status::text;
  end if;
end
$$;

alter table public.prestart_releases
  add column if not exists snapshot jsonb,
  add column if not exists superseded_at timestamptz,
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_by uuid,
  add column if not exists withdrawn_reason text;

-- superseded_by references another release, so it uses the same type as id.
do $$
declare
  id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into id_type
  from pg_attribute a
  where a.attrelid = 'public.prestart_releases'::regclass and a.attname = 'id';

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'prestart_releases'
      and column_name = 'superseded_by'
  ) then
    execute format('alter table public.prestart_releases add column superseded_by %s', id_type);
  end if;
end
$$;

alter table public.prestart_releases
  add constraint prestart_releases_status_check
  check (status in ('draft', 'released', 'superseded', 'withdrawn'));

create unique index if not exists prestart_releases_one_active
  on public.prestart_releases (project_id)
  where status = 'released';

create index if not exists prestart_releases_project_history
  on public.prestart_releases (project_id, released_at desc);

-- ---------------------------------------------------------------------------
-- 2. Canonical snapshot + readiness checks (single source of truth)
-- ---------------------------------------------------------------------------

create or replace function private.prestart_ts(value timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(value at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;

create or replace function private.prestart_crew_fingerprint(p_project_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(coalesce(string_agg(
    concat_ws('|',
      coalesce(pa.id::text, ''),
      coalesce(pa.user_id::text, ''),
      coalesce(pa.person_id::text, ''),
      coalesce(pa.assignment_role::text, ''),
      coalesce(pa.starts_on::date::text, ''),
      coalesce(pa.ends_on::date::text, '')
    ),
    ';' order by pa.id::text collate "C"
  ), ''))
  from public.project_assignments pa
  where pa.project_id = p_project_id
$$;

create or replace function private.prestart_snapshot(p_project_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'survey_id', s.id::text,
    'survey_updated_at', private.prestart_ts(s.updated_at::timestamptz),
    'system_id', ts.id::text,
    'system_updated_at', private.prestart_ts(ts.updated_at::timestamptz),
    'rams_id', r.id::text,
    'rams_updated_at', private.prestart_ts(r.updated_at::timestamptz),
    'site_id', st.id::text,
    'site_updated_at', private.prestart_ts(st.updated_at::timestamptz),
    'programme_start', p.programme_start::date::text,
    'programme_end', p.programme_end::date::text,
    'area_m2', trim_scale(p.area_m2::numeric)::text,
    'scope_summary', p.scope_summary::text,
    'crew_count', (select count(*) from public.project_assignments pa where pa.project_id = p.id),
    'crew_fingerprint', private.prestart_crew_fingerprint(p.id)
  )
  from public.projects p
  left join public.sites st on st.id = p.site_id
  left join public.technical_systems ts on ts.id = p.system_id
  left join lateral (
    select sv.id, sv.updated_at from public.surveys sv
    where sv.project_id = p.id
    order by sv.updated_at desc nulls last
    limit 1
  ) s on true
  left join lateral (
    select rd.id, rd.updated_at from public.rams_documents rd
    where rd.project_id = p.id
    order by rd.version desc
    limit 1
  ) r on true
  where p.id = p_project_id
$$;

-- Returns the codes of failed readiness checks (empty array = ready).
-- Mirrors lib/prestart.ts checks; release is only allowed while the project is
-- won / prestart / live.
create or replace function private.prestart_blockers(p_project_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p record;
  site record;
  survey record;
  system_status text;
  rams_status text;
  crew integer;
  blockers text[] := array[]::text[];
begin
  select pr.status::text as status, pr.client_id, pr.site_id, pr.area_m2,
         pr.programme_start, pr.programme_end, pr.scope_summary, pr.system_id
    into p
  from public.projects pr where pr.id = p_project_id;

  if not found then
    return array['project_missing'];
  end if;

  if p.status is null or p.status not in ('won', 'prestart', 'live') then
    blockers := array_append(blockers, 'authorised');
  end if;

  select st.address_line_1, st.postcode into site
  from public.sites st where st.id = p.site_id;

  if p.client_id is null or p.site_id is null
     or coalesce(btrim(site.address_line_1), '') = ''
     or coalesce(btrim(site.postcode), '') = ''
     or coalesce(p.area_m2::numeric, 0) <= 0
     or coalesce(btrim(p.scope_summary::text), '') = '' then
    blockers := array_append(blockers, 'site_scope');
  end if;

  if p.programme_start is null or p.programme_end is null
     or p.programme_end::date < p.programme_start::date then
    blockers := array_append(blockers, 'programme');
  end if;

  select sv.release_status::text as release_status,
         sv.technical_outcome::text as technical_outcome
    into survey
  from public.surveys sv
  where sv.project_id = p_project_id
  order by sv.updated_at desc nulls last
  limit 1;

  if survey.release_status is distinct from 'released'
     or survey.technical_outcome is distinct from 'suitable' then
    blockers := array_append(blockers, 'survey');
  end if;

  select ts.status::text into system_status
  from public.technical_systems ts where ts.id = p.system_id;

  if p.system_id is null or system_status is distinct from 'approved' then
    blockers := array_append(blockers, 'system');
  end if;

  select rd.status::text into rams_status
  from public.rams_documents rd
  where rd.project_id = p_project_id
  order by rd.version desc
  limit 1;

  if rams_status is distinct from 'approved' then
    blockers := array_append(blockers, 'rams');
  end if;

  select count(*) into crew
  from public.project_assignments pa where pa.project_id = p_project_id;

  if crew = 0 then
    blockers := array_append(blockers, 'crew');
  end if;

  return blockers;
end
$$;

-- Owner anywhere, or Supervisor with project access. Trusted server contexts
-- (no auth.uid(), e.g. service role / SQL editor) are allowed.
create or replace function private.can_release_prestart(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is null
      or private.current_user_role()::text = 'owner'
      or (private.current_user_role()::text = 'supervisor'
          and private.can_access_project(p_project_id))
$$;

-- ---------------------------------------------------------------------------
-- 3. Guard trigger: integrity of the release history
-- ---------------------------------------------------------------------------

create or replace function private.prestart_release_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  blockers text[];
  snap jsonb;
  internal boolean := coalesce(current_setting('resinspec.prestart_internal', true), '') = 'on';
  mutable_keys text[] := array['status', 'superseded_at', 'superseded_by',
                               'withdrawn_at', 'withdrawn_by', 'withdrawn_reason',
                               'updated_at'];
begin
  if tg_op = 'DELETE' then
    raise exception 'Pre-start releases are permanent history and cannot be deleted'
      using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'released' then
      raise exception 'A pre-start release can only be created with status released'
        using errcode = 'P0001';
    end if;

    if not private.can_release_prestart(new.project_id) then
      raise exception 'Owner or assigned Supervisor authority is required to release pre-start'
        using errcode = '42501';
    end if;

    blockers := private.prestart_blockers(new.project_id);
    if cardinality(blockers) > 0 then
      raise exception 'Pre-start is blocked: %', array_to_string(blockers, ', ')
        using errcode = 'P0001';
    end if;

    snap := private.prestart_snapshot(new.project_id);

    -- Everything below is set by the database; caller-supplied values are ignored.
    new.snapshot := snap;
    new.released_by := auth.uid();
    new.released_at := now();
    new.superseded_at := null;
    new.superseded_by := null;
    new.withdrawn_at := null;
    new.withdrawn_by := null;
    new.withdrawn_reason := null;
    new.updated_at := now();
    new.survey_id := (snap ->> 'survey_id')::uuid;
    new.survey_updated_at := (snap ->> 'survey_updated_at')::timestamptz;
    new.system_id := (snap ->> 'system_id')::uuid;
    new.system_updated_at := (snap ->> 'system_updated_at')::timestamptz;
    new.rams_id := (snap ->> 'rams_id')::uuid;
    new.rams_updated_at := (snap ->> 'rams_updated_at')::timestamptz;
    new.site_id := (snap ->> 'site_id')::uuid;
    new.site_updated_at := (snap ->> 'site_updated_at')::timestamptz;
    new.programme_start := (snap ->> 'programme_start')::date;
    new.programme_end := (snap ->> 'programme_end')::date;
    new.area_m2 := (snap ->> 'area_m2')::numeric;
    new.scope_summary := snap ->> 'scope_summary';
    new.crew_count := (snap ->> 'crew_count')::integer;
    new.crew_fingerprint := snap ->> 'crew_fingerprint';

    -- Supersede the previous active release (kept as history).
    perform set_config('resinspec.prestart_internal', 'on', true);
    update public.prestart_releases
       set status = 'superseded',
           superseded_at = now(),
           superseded_by = new.id,
           updated_at = now()
     where project_id = new.project_id
       and status = 'released';
    perform set_config('resinspec.prestart_internal', 'off', true);

    return new;
  end if;

  -- UPDATE: only status transitions and their bookkeeping may change.
  if (to_jsonb(new) - mutable_keys) is distinct from (to_jsonb(old) - mutable_keys) then
    raise exception 'Released pre-start snapshots are immutable; issue a new release instead'
      using errcode = 'P0001';
  end if;

  if new.status is not distinct from old.status then
    -- No transition: only allow touching updated_at.
    if new.superseded_at is distinct from old.superseded_at
       or new.superseded_by is distinct from old.superseded_by
       or new.withdrawn_at is distinct from old.withdrawn_at
       or new.withdrawn_by is distinct from old.withdrawn_by
       or new.withdrawn_reason is distinct from old.withdrawn_reason then
      raise exception 'Pre-start release history cannot be edited'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  if old.status = 'released' and new.status = 'superseded' then
    if not internal then
      raise exception 'A release is only superseded by issuing a new release'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  if old.status = 'released' and new.status = 'withdrawn' then
    if not private.can_release_prestart(old.project_id) then
      raise exception 'Owner or assigned Supervisor authority is required to withdraw pre-start'
        using errcode = '42501';
    end if;
    new.withdrawn_at := now();
    new.withdrawn_by := auth.uid();
    new.superseded_at := null;
    new.superseded_by := null;
    new.updated_at := now();
    return new;
  end if;

  raise exception 'Invalid pre-start release transition % -> %', old.status, new.status
    using errcode = 'P0001';
end
$$;

-- Move a won job into pre-start when its first release is issued (previously
-- done by the server action; now consistent for any authorised writer).
create or replace function private.prestart_release_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.projects
     set status = 'prestart',
         next_action = 'Prepare job / order materials',
         updated_at = now()
   where id = new.project_id
     and status = 'won';
  return null;
end
$$;

drop trigger if exists prestart_release_guard on public.prestart_releases;
create trigger prestart_release_guard
  before insert or update or delete on public.prestart_releases
  for each row execute function private.prestart_release_guard();

drop trigger if exists prestart_release_after_insert on public.prestart_releases;
create trigger prestart_release_after_insert
  after insert on public.prestart_releases
  for each row execute function private.prestart_release_after_insert();

-- ---------------------------------------------------------------------------
-- 4. App-facing read RPC
-- ---------------------------------------------------------------------------

create or replace function public.prestart_current_inputs(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not private.can_access_project(p_project_id) then
    raise exception 'Project access required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'snapshot', private.prestart_snapshot(p_project_id),
    'blockers', to_jsonb(private.prestart_blockers(p_project_id))
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------

revoke all on function private.prestart_ts(timestamptz) from public;
revoke all on function private.prestart_crew_fingerprint(uuid) from public;
revoke all on function private.prestart_snapshot(uuid) from public;
revoke all on function private.prestart_blockers(uuid) from public;
revoke all on function private.can_release_prestart(uuid) from public;
revoke all on function private.prestart_release_guard() from public;
revoke all on function private.prestart_release_after_insert() from public;

revoke all on function public.prestart_current_inputs(uuid) from public;
revoke all on function public.prestart_current_inputs(uuid) from anon;
grant execute on function public.prestart_current_inputs(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Backfill: canonical snapshot for existing release rows
-- ---------------------------------------------------------------------------
-- Rebuilds the snapshot from the legacy columns the app wrote. Rows that cannot
-- be converted keep snapshot = null, which the app treats as stale (safe:
-- forces a re-release rather than trusting an unverifiable snapshot).

alter table public.prestart_releases disable trigger prestart_release_guard;

do $$
declare
  rel record;
  crew text;
begin
  for rel in select * from public.prestart_releases where snapshot is null loop
    begin
      select md5(coalesce(string_agg(
        concat_ws('|',
          coalesce(e ->> 'id', ''),
          coalesce(e ->> 'user_id', ''),
          coalesce(e ->> 'person_id', ''),
          coalesce(e ->> 'assignment_role', ''),
          coalesce((e ->> 'starts_on')::date::text, ''),
          coalesce((e ->> 'ends_on')::date::text, '')
        ),
        ';' order by (e ->> 'id') collate "C"
      ), ''))
      into crew
      from jsonb_array_elements(coalesce(nullif(rel.crew_fingerprint::text, ''), '[]')::jsonb) e;

      update public.prestart_releases
         set snapshot = jsonb_build_object(
               'survey_id', rel.survey_id::text,
               'survey_updated_at', private.prestart_ts(rel.survey_updated_at::timestamptz),
               'system_id', rel.system_id::text,
               'system_updated_at', private.prestart_ts(rel.system_updated_at::timestamptz),
               'rams_id', rel.rams_id::text,
               'rams_updated_at', private.prestart_ts(rel.rams_updated_at::timestamptz),
               'site_id', rel.site_id::text,
               'site_updated_at', private.prestart_ts(rel.site_updated_at::timestamptz),
               'programme_start', rel.programme_start::date::text,
               'programme_end', rel.programme_end::date::text,
               'area_m2', trim_scale(rel.area_m2::numeric)::text,
               'scope_summary', rel.scope_summary::text,
               'crew_count', rel.crew_count::integer,
               'crew_fingerprint', crew
             )
       where id = rel.id;
    exception when others then
      raise notice 'prestart_releases %: snapshot not backfilled (%)', rel.id, sqlerrm;
    end;
  end loop;
end
$$;

-- Legacy reopened rows ('draft') become withdrawn history.
update public.prestart_releases
   set status = 'withdrawn',
       withdrawn_at = coalesce(withdrawn_at, updated_at::timestamptz, now())
 where status = 'draft';

alter table public.prestart_releases enable trigger prestart_release_guard;

commit;
