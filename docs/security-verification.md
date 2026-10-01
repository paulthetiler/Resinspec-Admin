# Security Verification

Date: 1 October 2026

## Owner login

- Owner account: `paul@resinspec.uk`
- Auth account confirmed and active.
- App role verified as `owner`.
- Live sign-in verified by Supabase `last_sign_in_at`.

## RLS role simulation

The database access model was tested in a rolled-back transaction using the real Owner auth UUID while temporarily switching the app role. Two temporary projects were created:

- one assigned to the simulated user
- one unassigned

Temporary rows were also created for:

- commercial data
- a quote
- one draft + one approved controlled document
- one draft + one approved RAMS revision
- QA

No test rows were retained after rollback.

### Results

| Role | Assigned job | Unassigned job | Commercial | Quote | Docs | RAMS | QA |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Owner | 1 | 1 | 1 | 1 | 2 | 2 | 1 |
| Office | 1 | 1 | 0 | 1 | 2 | 2 | 1 |
| Commercial | 1 | 1 | 1 | 1 | 2 | 2 | 1 |
| Supervisor | 1 | 0 | 0 | 0 | 2 | 2 | 1 |
| Installer | 1 | 0 | 0 | 0 | 1 | 1 | 1 |

Interpretation:

- Office sees client-facing quotes but cannot read internal commercial rows.
- Commercial retains internal commercial access.
- Supervisor only sees assigned projects and cannot see quotes or internal commercial data.
- Installer only sees assigned projects.
- Installer sees only the approved/current controlled document and approved RAMS revision; draft rows are hidden.
- QA remains accessible on assigned work.

Post-test verification confirmed:

- Owner role remained `owner` and active.
- Zero `TEST-RLS-*` projects remained.

## Current Supabase advisor state

Row/storage policy checks are passing for the implemented access model.

Supabase currently reports one Auth hardening warning:

- Leaked password protection disabled.

That setting is a project-level Auth configuration and is not exposed by the connected Supabase toolset. It should be enabled later in Supabase Auth settings (Pro feature) when convenient.
