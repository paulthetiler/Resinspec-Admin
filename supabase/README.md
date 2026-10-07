# ResinSpec Admin — Supabase database baseline

Status: **baseline NOT yet captured; partial policy evidence reviewed; TASK #21 open** (7 October 2026).

The live Supabase project (`vsizfxdtmlxygjnlcztf`, eu-west-2) holds the schema,
RLS policies, triggers, RPCs, storage buckets/policies and three Edge Functions.
None of these have ever been committed to this repository. The audit session
that created this folder had only the public publishable key, which cannot read
schema or policy definitions. Live facts below were confirmed separately through
the Supabase connector by the project owner.

## Confirmed live facts (via Supabase connector, 7 October 2026)

| Item | Confirmed state |
| --- | --- |
| Project | ResinSpec Admin · `vsizfxdtmlxygjnlcztf` · eu-west-2 · ACTIVE_HEALTHY |
| RLS | Enabled on the public tables inspected, including `prestart_releases`, `worker_expenses`, `site_issues`, `subcontractor_invoices`, `user_notifications`. **Policy contents not yet reviewed.** |
| Security advisor | Leaked Password Protection Disabled (warning) |
| Edge Function `bootstrap-owner` | active, `verify_jwt = true`; source returns 410 "Bootstrap disabled" |
| Edge Function `admin-create-user` | active, `verify_jwt = false`; source enforces authenticated user + `owner` role internally |
| Edge Function `resinspec-mcp` | active, `verify_jwt = false`; `withOAuthProtectedResource()` + user-context Supabase client |
| Storage buckets | `cis-invoices`, `project-documents`, `site-issues`, `worker-receipts` all private (`public = false`) |

Live migration history (as supplied; may not be the full list):

```
20261006214338 link_documents_to_qa_gates
20261006220540 survey_release_and_prestart_control
20261006220725 survey_review_audit_fields
20261006221102 strengthen_prestart_release_snapshot
20261006225913 estimate_item_idempotency_and_draft_write_policy
20261007063846 worker_expenses_and_site_issues
20261007064034 cis_subcontractor_invoices
20261007064306 cis_invoice_revision_workflow
20261007163932 add_subcontractor_compliance_fields
```

None of these migration files exist in this repository. The foundation schema
(profiles, projects, clients, RLS helpers, storage, roles; i.e. everything
before 6 October) does not appear in the supplied list. Either the list is
partial or that schema was applied outside the migration history; this
determines whether migrations alone can rebuild the database.

## Audit classification (updated 7 October 2026, second evidence set)

Evidence sources: anonymous probe (`scripts/probe-anon-boundary.sh`) and
read-only extracts supplied by the project owner via the Supabase connector.
No test users were created and no live data was modified.

### PROVEN SAFE

- Unauthenticated REST reads return 0 rows on all 33 app tables (RLS enabled).
- Unauthenticated callers cannot list storage buckets or objects; `current_app_role` is not executable by `anon`.
- All four app buckets (`cis-invoices`, `project-documents`, `site-issues`, `worker-receipts`) are private (`public = false`); no public-URL access.
- `admin-create-user`: despite `verify_jwt = false`, source uses `withSupabase({ auth: "user" })`, calls `current_app_role()`, requires `owner`, then validates person/active/email/existing login before calling the admin API. Not an unauthenticated user-creation path.
- `bootstrap-owner`: deployed source returns HTTP 410 "Bootstrap disabled" and performs no action. A self-registered user cannot become Owner through it.
- `resinspec-mcp`: wrapped in `withOAuthProtectedResource()` + `withSupabase({ auth: "user" })`; database calls run in the caller's RLS context. Not a service-role bypass (individual tool effects remain bounded by RLS, see below).
- Commercial isolation at the database: `project_commercials` require `private.can_view_commercial()`; `estimates` and `invoices` require commercial visibility **and** project access; `people_commercials` limited to Owner/Commercial.
- Project scoping exists at the database: `projects` SELECT uses `private.can_access_project(id)`; `documents`, `prestart_releases`, `project_assignments` and RAMS acknowledgements are project/user scoped.
- `prestart_releases` INSERT/UPDATE is restricted to Owner or Supervisor (Installer/Office/Commercial cannot write releases directly).

Caveat: these rest on policy text as supplied. The helper bodies
(`private.can_access_project`, `private.can_view_commercial`) have not yet been
reviewed, so "project scoped" is only as strong as those functions.

### PROVEN VULNERABILITY / DESIGN GAP

1. **QA workflow not enforced by the database (architectural integrity gap → TASK #23).**
   `qa_records` SELECT/INSERT/UPDATE policies are all `private.can_access_project(project_id)`.
   RLS enforces none of: gate sequence, current status, completion-before-acceptance,
   photo/reading/batch evidence, Owner/Supervisor-only acceptance, separation of
   completer and reviewer, or immutability of accepted gates. Any user with project
   access (including an Installer on an assigned job, and Office/Commercial on any
   job) can, via the API, set a gate to `accepted`, re-open an accepted gate, or
   insert extra gate rows. The client QA/handover report would reflect the result.
   (Only a trigger could still block this; none has been shown. Trigger list pending.)
2. **People tax/identity fields exposed by row-level design (privacy gap).**
   `people` SELECT allows Owner, Office, Commercial, Supervisor or the person
   themselves; `ni_number`, `utr`, `cis_*`, `status_outcome` live on the same row
   and `authenticated` holds grants on those columns. Office, Commercial and
   Supervisor can read every person's NI number/UTR via the API regardless of UI.
   Remediation later: column revoke, restricted table, or security-barrier view.
3. **Public email sign-up enabled** (`disable_signup: false`; not yet confirmed changed).
   Impact is reduced (bootstrap disabled, admin-create-user Owner-gated) but a
   self-registered user still holds an authenticated session; their reach depends
   on helper functions and any `authenticated`-wide policies (pending).
4. **Leaked Password Protection disabled** (security advisor).
5. **Database not reproducible from the repository.** Live migrations
   (20261006214338 … 20261007163932) are absent from the repo; foundation
   schema, policies, helper functions, storage policies and Edge Function source
   are not in source control.

### UNVERIFIED

- Bodies of `private.can_access_project`, `private.can_view_commercial`, `current_app_role` and any other `private.*` helpers (assignment logic, use of `starts_on`/`ends_on`, behaviour for users with no role, `SECURITY DEFINER` / `search_path`).
- Behaviour for an authenticated user with **no** ResinSpec role (depends on helpers above and any `TO authenticated USING (true)` policies, e.g. on `technical_systems`, `profiles`, `clients`, `sites`).
- `qa_records` DELETE policy and any QA triggers (whether gates can be deleted; whether any trigger offsets gap 1).
- `prestart_releases`: whether a Supervisor can write a `released` row whose checks do not pass (no DB validation shown), and whether a trigger exists.
- `worker_expenses` and `subcontractor_invoices`: UPDATE policies (can a submitter change their own status/amount, mark `paid`, or edit after approval? can reviewers set `paid` from `pending`/`rejected`?); per-user SELECT isolation for Installers.
- `site_issues`, `snags`, `handover_records`, `variations`, `site_readings`, `batch_logs` policies (who can update status / accept).
- `user_notifications`: SELECT limited to own user? INSERT allowed for whom (needed for cross-user CIS notifications, but must not allow arbitrary spoofed notifications)?
- `set_user_role`, `get_user_role`, `approve_technical_system`: Owner enforcement inside the functions and EXECUTE grants.
- Database triggers backing roll-ups (variations/invoices → `project_commercials`), quote acceptance → Won/budget, estimate totals, audit events; and whether `project_commercials` manual UPDATE can overwrite roll-ups.
- `storage.objects` policies for the four buckets: cross-project reads, other users' receipts/invoices/issue photos, Installer access to draft documents, upload path enforcement, update/delete rights.
- `resinspec-mcp` tool list and the OAuth client/scopes registered (effective reach equals the user's RLS rights).
- `people` column grants/views: whether any mechanism (column revoke, view) narrows gap 2.
- Current Auth sign-up setting.

## Files

| Path | Purpose |
| --- | --- |
| `supabase/audit/catalog_inventory.sql` | Read-only catalog query (tables, RLS flags, policies, grants, functions, triggers, storage buckets/policies). Runs in a `READ ONLY` transaction and rolls back. Reads no business rows. |
| `scripts/capture-db-baseline.sh` | Schema-only dump into `supabase/migrations/<ts>_remote_baseline.sql`, runs the catalog inventory, downloads Edge Function source, then runs the secret scan. |
| `scripts/secret-scan.sh` | Pattern scan of changed/untracked files for secret keys, JWTs, connection strings and private keys. Run before every commit that touches `supabase/`. |
| `scripts/probe-anon-boundary.sh` | Read-only probe of what an unauthenticated caller can reach with the public key (HEAD + `count=exact`; no row data). |

## Capturing the baseline

1. Create a **read-only** Postgres role (or use the dashboard's read-only
   connection) and add its connection string to the environment as
   `SUPABASE_DB_URL`. Never paste it into a file or commit it.
2. Optionally add `SUPABASE_ACCESS_TOKEN` (for Edge Function source download).
3. Run `./scripts/capture-db-baseline.sh`.
4. Review `supabase/migrations/*_remote_baseline.sql` and
   `supabase/audit/catalog_inventory.out.txt`; they must contain structure only.
5. `./scripts/secret-scan.sh` must report clean before committing.

Notes:

- `supabase db dump` needs a `pg_dump` matching the server major version. The
  container used for this audit has `pg_dump` 16; if the project runs Postgres
  17, use the Supabase CLI path (Docker) rather than the local fallback.
- Auth configuration (sign-up, password policy, leaked-password protection,
  OAuth server clients) is **not** in the database dump. Record it separately
  (Dashboard → Authentication, or `supabase config` once linked).

## Evidence gathered so far (anonymous, read-only)

From `scripts/probe-anon-boundary.sh`, run 7 October 2026:

| Check | Result |
| --- | --- |
| Auth `disable_signup` | **false: public email sign-up is enabled** (README says there is no public signup) |
| Auth `mailer_autoconfirm` | false (email confirmation required) |
| Auth anonymous users | false |
| 33 app tables via REST as anon | HTTP 200, 0 rows visible on every table: anon holds SELECT grants; RLS is the only barrier |
| `user_roles` via REST | 404, not in an exposed schema (consistent with "private `user_roles`") |
| `qa_readings` | does not exist; readings live in `site_readings` |
| Storage buckets as anon | none listed; object list returns `[]` for all four buckets |
| `rpc/current_app_role` as anon | `42501 permission denied`: EXECUTE revoked from anon |
| Edge Function `admin-create-user` | exists (CORS preflight 204; unknown function returns 404) |

## Evidence still required to close TASK #21

1. Definitions of `private.can_access_project`, `private.can_view_commercial`, `current_app_role` and every other `private.*` / `public.*` function, with `SECURITY DEFINER` flag, `search_path` and EXECUTE grants (catalog sections 9–10). Specifically `set_user_role`, `get_user_role`, `approve_technical_system`.
2. Full `pg_policies` output for every `public` table not already supplied, including DELETE policies and `WITH CHECK` clauses: `qa_records` (DELETE), `worker_expenses`, `subcontractor_invoices`, `user_notifications`, `site_issues`, `snags`, `handover_records`, `variations`, `site_readings`, `batch_logs`, `technical_systems`, `profiles`, `clients`, `sites`, `quotes`, `surveys`, `rams_*`, `document_acknowledgements`, `audit_events`, `project_actions`.
3. `storage.objects` policies for the four buckets (catalog section 6, schema `storage`).
4. Trigger list and trigger function bodies (section 11), including any on `auth.users`, `qa_records`, `prestart_releases`, `variations`, `invoices`, `quotes`.
5. Column-level grants on `people` and any views over it (sections 8, 12).
6. Check/unique constraints on status columns and QA gates (section 3).
7. Auth: current `disable_signup` value; registered OAuth clients and scopes for `resinspec-mcp`.
8. For rebuildability: full migration list with statements (or schema-only dump) and confirmation of whether pre-6-October foundation objects are in migration history.

## Still to verify once the baseline exists

Run authenticated role tests against a **local or branch database restored from
the baseline**, not production. For each of Owner / Office / Commercial /
Supervisor / Installer, plus an authenticated user with **no** role (possible
because sign-up is open), test via the REST API, not the UI:

- read/insert/update/delete on every table above, including cross-project rows
- column exposure of `people.ni_number`, `utr`, `cis_*`, `status_outcome`
- `people_commercials`, `project_commercials`, `estimates`, `invoices`, `variations`
- `qa_records` direct update (out-of-sequence, re-completing accepted gates)
- `prestart_releases`, `handover_records`, `snags` direct writes
- `worker_expenses` / `subcontractor_invoices` status set to `paid` from any state,
  and reading or updating other users' rows
- `user_notifications` read/insert for other users
- storage upload/download/delete in `project-documents`, `worker-receipts`,
  `site-issues`, `cis-invoices` for unassigned projects and other users' paths
- EXECUTE on `set_user_role`, `get_user_role`, `approve_technical_system`
  for non-owner roles
- `admin-create-user` invoked by non-owner JWTs
