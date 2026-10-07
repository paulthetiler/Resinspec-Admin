-- Minimal stand-in for the live ResinSpec Supabase schema, used ONLY by the
-- local database tests (scripts/test-db.sh). It reproduces the objects the
-- TASK #22 migration depends on, following the definitions verified in
-- TASK #21 (supabase/README.md): auth.uid(), private.user_roles,
-- private.current_user_role(), private.can_access_project(), the tables the
-- pre-start snapshot reads, and the legacy one-row-per-project
-- prestart_releases table with its verified RLS policies.
--
-- It is NOT a copy of production and must never be applied to it.

create role anon nologin;
create role authenticated nologin;

create schema auth;
create schema private;

grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create table private.user_roles (
  user_id uuid primary key,
  role text not null,
  active boolean not null default true
);
grant select on private.user_roles to authenticated;

create function private.current_user_role() returns text
language sql stable as $$
  select ur.role from private.user_roles ur
  where ur.user_id = auth.uid() and ur.active
$$;

create table public.clients (id uuid primary key default gen_random_uuid(), legal_name text);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  name text,
  address_line_1 text,
  postcode text,
  updated_at timestamptz not null default now()
);

create table public.technical_systems (
  id uuid primary key default gen_random_uuid(),
  code text,
  revision integer,
  status text not null default 'draft',
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  reference text,
  title text,
  status text not null default 'lead',
  client_id uuid references public.clients(id),
  site_id uuid references public.sites(id),
  system_id uuid references public.technical_systems(id),
  area_m2 numeric,
  programme_start date,
  programme_end date,
  scope_summary text,
  next_action text,
  updated_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  user_id uuid,
  active boolean not null default true
);

create table public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  person_id uuid references public.people(id),
  user_id uuid,
  assignment_role text,
  starts_on date,
  ends_on date
);

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  release_status text not null default 'draft',
  technical_outcome text,
  updated_at timestamptz not null default now()
);

create table public.rams_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  version integer not null,
  status text not null default 'draft',
  updated_at timestamptz not null default now()
);

create table public.qa_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  hold_point text not null,
  status text not null default 'open'
);

-- Verified helper (TASK #21): Owner/Office/Commercial everywhere, otherwise
-- assignment by user_id or via people.user_id. SECURITY INVOKER.
create function private.can_access_project(target_project uuid) returns boolean
language sql stable as $$
  select coalesce(private.current_user_role() in ('owner', 'office', 'commercial'), false)
      or exists (
        select 1
        from public.project_assignments pa
        left join public.people pe on pe.id = pa.person_id
        where pa.project_id = target_project
          and (pa.user_id = auth.uid() or pe.user_id = auth.uid())
      )
$$;

-- Legacy shape: one row per project, keyed on project_id.
create table public.prestart_releases (
  project_id uuid primary key references public.projects(id),
  status text not null default 'draft' check (status in ('draft', 'released')),
  release_note text,
  released_by uuid,
  released_at timestamptz,
  survey_id uuid,
  survey_updated_at timestamptz,
  system_id uuid,
  system_updated_at timestamptz,
  rams_id uuid,
  rams_updated_at timestamptz,
  site_id uuid,
  site_updated_at timestamptz,
  programme_start date,
  programme_end date,
  area_m2 numeric,
  scope_summary text,
  crew_count integer,
  crew_fingerprint text,
  updated_at timestamptz not null default now()
);

alter table public.prestart_releases enable row level security;

-- Verified policies (TASK #21): project-scoped read; insert/update by Owner or
-- Supervisor on an accessible project; no delete policy.
create policy prestart_releases_select on public.prestart_releases
  for select to authenticated
  using (private.can_access_project(project_id));

create policy prestart_releases_insert on public.prestart_releases
  for insert to authenticated
  with check (private.current_user_role() in ('owner', 'supervisor')
              and private.can_access_project(project_id));

create policy prestart_releases_update on public.prestart_releases
  for update to authenticated
  using (private.current_user_role() in ('owner', 'supervisor')
         and private.can_access_project(project_id))
  with check (private.current_user_role() in ('owner', 'supervisor')
              and private.can_access_project(project_id));

-- Supabase-style broad table grants; RLS is the boundary.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema private to authenticated;
