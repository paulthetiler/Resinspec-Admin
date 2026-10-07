-- Daywork sheets linked to controlled variations.
begin;
create table if not exists public.daywork_sheets (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 variation_id uuid references public.variations(id) on delete set null,
 reference text not null,
 work_date date not null default current_date,
 instruction_by_name text,
 instruction_by_company text,
 work_description text not null,
 labour jsonb not null default '[]'::jsonb,
 plant jsonb not null default '[]'::jsonb,
 materials jsonb not null default '[]'::jsonb,
 evidence_notes text,
 status text not null default 'draft' check(status in ('draft','submitted','acknowledged','disputed','withdrawn')),
 submitted_by uuid,
 submitted_at timestamptz,
 client_name text,
 client_position text,
 client_company text,
 client_email text,
 client_acknowledgement_note text,
 client_acknowledged_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists daywork_project_reference_uq on public.daywork_sheets(project_id,reference);
create index if not exists daywork_variation_idx on public.daywork_sheets(variation_id);
alter table public.daywork_sheets enable row level security;
commit;
