-- Controlled variation workflow for ResinSpec.
begin;

alter table public.variations
  add column if not exists reason text,
  add column if not exists requested_by_name text,
  add column if not exists requested_by_company text,
  add column if not exists work_started boolean not null default false,
  add column if not exists site_labour_days numeric,
  add column if not exists material_notes text,
  add column if not exists evidence_notes text,
  add column if not exists technical_verified_by uuid,
  add column if not exists technical_verified_at timestamptz,
  add column if not exists internal_approved_by uuid,
  add column if not exists internal_approved_at timestamptz,
  add column if not exists client_name text,
  add column if not exists client_position text,
  add column if not exists client_company text,
  add column if not exists client_email text,
  add column if not exists client_authority_confirmed boolean not null default false,
  add column if not exists client_accepted_at timestamptz,
  add column if not exists client_acceptance_note text,
  add column if not exists released_at timestamptz,
  add column if not exists emergency_instruction boolean not null default false,
  add column if not exists emergency_instruction_note text,
  add column if not exists revision integer not null default 1;

-- Preserve old values while allowing the controlled states.
do $$
declare r record;
begin
 for r in select conname from pg_constraint
  where conrelid='public.variations'::regclass and contype='c'
    and pg_get_constraintdef(oid) ilike '%status%'
 loop execute format('alter table public.variations drop constraint %I',r.conname); end loop;
end $$;

alter table public.variations add constraint variations_status_controlled_check
 check (status in (
  'draft','site_submitted','technical_verified','pricing','internal_approved',
  'sent_to_client','client_query','accepted','released','completed','invoiced',
  'rejected','withdrawn','proceed_at_risk'
 ));

create index if not exists variations_project_status_idx
 on public.variations(project_id,status);

commit;
