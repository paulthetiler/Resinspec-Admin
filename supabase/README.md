# ResinSpec Admin — Supabase database baseline

Status: **baseline NOT yet captured; RLS, storage and function definitions reviewed; triggers/grants/constraints pending; TASK #21 open** (7 October 2026).

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

## Verified RLS policy summary (third evidence set, 7 October 2026)

As read from the live project by the owner. `access` = `private.can_access_project(project_id)`;
`manage` = `private.can_manage_project()` (helper bodies not yet reviewed).
O/Of/C/S/I = Owner / Office / Commercial / Supervisor / Installer.

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `qa_records` | access | access | access | manage |
| `batch_logs` | access | access | access | manage |
| `site_readings` | access | access | access | manage |
| `snags` | access | access | access | manage |
| `handover_records` | access | O/Of/C/S + access | O/Of/C/S + access | O/Of/C/S + access |
| `prestart_releases` | project-scoped | O/S | O/S | — |
| `worker_expenses` | access AND (own OR O/Of/C/S) | own (`submitted_by = auth.uid()`) + access | O/Of/C + access | — |
| `subcontractor_invoices` | access AND (own OR O/Of/C) | own + access | O/Of/C + access | — |
| `user_notifications` | own | O/Of/C | own (USING + WITH CHECK) | — |
| `site_issues` | access | own (`raised_by`) + access | O/Of/C/S + access | — |
| `variations` | commercial + access | commercial + access | commercial + access | commercial + access |
| `surveys` | access | O/Of/C/S + access | O/Of/C/S + access | manage |
| `technical_systems` | approved OR O/C/S OR attached to accessible project | O | O | O |
| `rams_documents` | access AND (mgmt/S OR approved) | O/Of/S + access | O/Of/S + access | O |
| `rams_acknowledgements` | own OR O/Of/S on accessible project | own, approved RAMS, accessible project | — | O |
| `document_acknowledgements` | own OR project management | own, accessible document | — | manage |
| `project_actions` | accessible project OR assigned owner OR O/Of/C | O/Of/C/S (+ access if project) | O/Of/C/S (+ access if project) | O/Of/C |
| `profiles` | own OR O/Of/C/S | own | own OR O/Of | — |
| `clients`, `sites` | mgmt OR linked to accessible project | manage | manage | manage |
| `quotes` | O/Of/C + access | O/Of/C + access | O/Of/C + access | O/Of/C + access |
| `project_commercials` | `can_view_commercial()` | | | |
| `estimates`, `invoices` | commercial + access | | | |
| `people_commercials` | O/C | | | |
| `people` | O/Of/C/S OR self | | | |
| `audit_events` | role/context sensitive (commercial entities need commercial visibility; quotes O/Of/C; project events O/Of/C/S + access; non-project O/Of/C) | | | |

### Storage (`storage.objects`), all four buckets private

| Bucket | Upload | Read | Update / delete |
| --- | --- | --- | --- |
| `project-documents` | project access from project ID in path | matching `documents` row + project access; non-management limited to approved/complete | project management, or document owner while draft |
| `worker-receipts` | path must start with a project the user is assigned to | file owner OR O/Of/C/S | none returned |
| `site-issues` | path must start with an assigned project | file owner OR O/Of/C/S | none returned |
| `cis-invoices` | path must start with an assigned project | file owner OR O/Of/C | none returned |

## Verified function definitions (fourth evidence set, 7 October 2026)

| Function | Security | Behaviour (as supplied) |
| --- | --- | --- |
| `private.current_user_role()` | INVOKER | role from `private.user_roles` for `auth.uid()` where `active = true` |
| `private.has_role(allowed)` | INVOKER | `current_user_role()` in allowed list; no active role → false |
| `private.is_owner()` | DEFINER | `user_roles` row for `auth.uid()`, role `owner`, active |
| `private.can_access_project(id)` | INVOKER | true for Owner/Office/Commercial, or if `project_assignments.user_id = auth.uid()`, or `project_assignments.person_id → people.user_id = auth.uid()`. Assignment dates not considered |
| `private.can_manage_project()` | INVOKER | Owner/Office/Commercial |
| `private.can_view_commercial()` | INVOKER | Owner/Commercial |
| `private.storage_project_id(path)` | INVOKER | first path segment parsed as UUID; invalid → null |
| `public.current_app_role()` | INVOKER | `current_user_role()` as text |
| `public.set_user_role(...)` | INVOKER | raises "Owner access required" unless `is_owner()`; then upserts `private.user_roles` |
| `public.approve_technical_system(...)` | INVOKER | requires `has_role(owner)`; draft only; retires previously approved system with same code; sets `approved_by` |
| `public.get_user_role(target)` | INVOKER | returns target's active role; **no explicit authorisation check in body** |
| `private.quote_status_transition()` | trigger fn | issued → project `quoted` (early stages); accepted → `won` (unless later), estimate accepted, values copied to `project_commercials` |
| `private.refresh_estimate_totals()` | trigger fn | direct cost from items → contingency/risk-adjusted cost → sell price from margin |
| `private.refresh_project_commercial_rollup()` / `commercial_rollup_trigger()` | trigger fn | approved variations, invoiced, paid, retention → `project_commercials` |
| `private.enforce_document_qa_project_match()` | trigger fn | QA-linked document must share the QA record's project |
| `private.enforce_document_survey_project_match()` | trigger fn | same for surveys |
| `private.bootstrap_auth_user()` | DEFINER | creates `profiles` row; links an existing `people` row where `people.user_id IS NULL` AND `new.email IS NOT NULL` AND `lower(people.email) = lower(new.email)` (**no `people.active` check**); otherwise creates `people` (`user_id = new.id`, `subcontractor`, `primary_role = null`). Assigns no app role |

Trigger **attachments** (which table/event fires each function) not yet supplied.

## Audit classification (fourth evidence set, 7 October 2026)

Evidence: anonymous probe plus read-only extracts supplied by the owner via the
Supabase connector. No test users created; no live data modified.
"PROVEN" = proven from definitions/policy text; behaviour was not executed.

### PROVEN SAFE / CONTROLLED

Platform:
- Unauthenticated REST reads return 0 rows on all 33 app tables; buckets/objects not listable; `current_app_role` not executable by `anon`.
- All four buckets private.
- `admin-create-user` enforces authenticated user + `owner` internally (despite `verify_jwt = false`).
- `bootstrap-owner` disabled (HTTP 410).
- `resinspec-mcp` OAuth-protected; runs in the caller's RLS context.

Authorisation helpers:
- `can_access_project`: global only for Owner/Office/Commercial; Supervisor and Installer need an assignment.
- `can_manage_project` = Owner/Office/Commercial; `can_view_commercial` = Owner/Commercial.
- A user with no active role fails `has_role`, `can_manage_project`, `can_view_commercial`, and gets no global project access.
- `set_user_role` and `approve_technical_system` enforce Owner inside the function.
- `storage_project_id` rejects non-UUID path prefixes.
- `bootstrap_auth_user` assigns no app role (sign-up cannot create a privileged user directly).

RLS:
- Installers cannot update their submitted `worker_expenses` / `subcontractor_invoices`; Supervisors cannot update expenses.
- Expenses / CIS invoices insertable only as oneself; Installers see only their own rows.
- `user_notifications`: own rows only (read/update); `user_id` cannot be reassigned.
- Commercial isolation (`project_commercials`, `estimates`, `invoices`, `variations`, `people_commercials`, `quotes`).
- `prestart_releases` writable only by Owner/Supervisor (Supervisor only on assigned projects).
- Draft/superseded documents and unapproved RAMS hidden from Installers (table and storage).
- `technical_systems` writes Owner-only.
- Acknowledgements only creatable for oneself.
- `cis-invoices` objects not readable by Supervisor/Installer except own uploads.
- No UPDATE/DELETE route on `worker-receipts`, `site-issues`, `cis-invoices` objects for ordinary users (as supplied).
- Database-side calculations exist for estimate totals, quote acceptance and commercial roll-ups (firing not yet confirmed; see UNVERIFIED).

### PROVEN VULNERABILITY / DESIGN-INTEGRITY GAP

1. **QA workflow not encoded in RLS (→ TASK #23).** `qa_records` INSERT/UPDATE = `can_access_project`: assigned Installers/Supervisors and all Office/Commercial users can set any gate status directly (accept, re-open accepted gates, skip sequence, bypass evidence and reviewer rules). Trigger attachment list still outstanding.
2. **QA evidence tables writable by any project-access user.** `site_readings`, `batch_logs`, `snags`: readings/batches satisfying Gates 4/6 can be edited after the fact; an Installer can set a snag `accepted`, defeating the Gate 8 check.
3. **Handover state machine not encoded.** Owner/Office/Commercial/Supervisor (with access) can write any `handover_records` status directly.
4. **Expense / CIS status transitions not encoded in RLS.** Management UPDATE allows any transition (e.g. `pending`/`rejected` → `paid`) and amount edits; no constraint/trigger evidence yet.
5. **People tax/identity fields readable by Office, Commercial, Supervisor** (same row, authenticated column grants). Supervisor reads are not project-scoped by the `people` policy.
6. **Storage privacy: Supervisor cross-project reads.** `worker-receipts` and `site-issues` read policies allow the Supervisor role with no project-access condition (exact policy text confirmed). A Supervisor can read receipt and issue-photo objects for unassigned jobs if paths are known or listable. `cis-invoices` does not include Supervisor.
7. **Public email sign-up enabled** (`disable_signup: false`, last checked 7 Oct). Impact substantially reduced by the helpers (no role, no global access), but unnecessary for an internal app and see the UNVERIFIED email-link path below.
8. **Leaked Password Protection disabled.**
9. **Database not reproducible from the repository.**

### Operational consequence confirmed (not security)

- `approve_technical_system` retires the previously approved revision with the same code. Live jobs still pointing at the retired revision then fail the pre-start "approved system" check and the Gate 4 `status = 'approved'` check in the app, and their pre-start snapshot goes stale (see first audit, pre-start deadlock).
- Assignment expiry is not considered by `can_access_project`: an assigned Supervisor/Installer retains database project access until the assignment row is removed, regardless of `starts_on` / `ends_on`.

### Application ↔ database mismatches (functional)

- Handover/snag acceptance: RLS allows Office/Commercial; server actions require `qa:complete`, which they lack.
- `subcontractor_invoices` UPDATE allows Commercial; the app gives `invoices:review` to Office only.
- `user_notifications` INSERT lets Office/Commercial send any user a notification with an arbitrary `href` (rendered as a link). Low risk.
- Storage uploads to `worker-receipts` / `site-issues` / `cis-invoices` require an **assignment**, not `can_access_project`; Owner/Office/Commercial without an assignment cannot upload there even though the app offers them the forms where they hold submit permissions.

### UNVERIFIED

- **Self-sign-up + email link (highest priority; pending trigger attachment only).** Verified from the function bodies: `bootstrap_auth_user` links a new Auth account to an existing `people` row where `people.user_id IS NULL` and the email matches case-insensitively, with no `people.active` check; `can_access_project` grants access through `project_assignments.person_id → people.user_id = auth.uid()`. Therefore, **if** `bootstrap_auth_user` is attached to `auth.users` creation, public self-registration with the email address of an already-assigned, not-yet-linked person would link that account to the person and inherit their project assignments without Owner-issued access. Only remaining evidence: the `auth.users` trigger attachment. If it fires on `auth.users` INSERT, reclassify as a **PROVEN ACCESS-CONTROL VULNERABILITY** and treat disabling public sign-up as an immediate priority.
- `get_user_role`: no internal check; depends on EXECUTE grant to `authenticated` and on `private.user_roles` SELECT grants/RLS for INVOKER callers. If callable and `user_roles` readable, any user can enumerate other users' roles (low impact, information disclosure).
- `private.user_roles` grants and RLS (also governs whether INVOKER helpers work and whether rows can be self-written).
- EXECUTE grants on all public/private functions (especially `get_user_role`; also whether `private.is_owner` / helpers are exposed).
- Trigger attachment/event list: whether roll-ups, quote transition, estimate totals, document-project checks, audit events and `bootstrap_auth_user` fire on the expected tables/events; whether any QA/handover/expense/CIS transition triggers exist.
- Constraints: QA uniqueness per (project, gate) and status values; expense/CIS/quote/invoice/variation/handover/snag status checks.
- `people`: any view or column revoke over sensitive fields.
- `technical_systems` SELECT policy `TO` role: the "approved" branch has no role condition; whether a role-less authenticated user can read approved systems.
- `documents` INSERT/UPDATE `WITH CHECK`: can an Installer write a row directly as `approved`?
- `profiles` columns (any authority-bearing column a user can self-update).
- `project_commercials` write policy (can Commercial manual edits overwrite roll-ups?).
- Current Auth sign-up setting; `resinspec-mcp` OAuth clients/scopes.
- Rebuild evidence (full migration history with statements or schema dump).

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

## Evidence still required to close TASK #21 (final evidence stage)

1. **Trigger attachment list**: table, timing, events and function for every trigger, especially `auth.users` → `bootstrap_auth_user` (INSERT vs confirmation) and all QA, commercial roll-up, quote, estimate, document-match, audit and status triggers.
2. **Function EXECUTE grants** to `anon` / `authenticated` / `public`, especially `get_user_role`.
3. **`private.user_roles`** grants and RLS policies.
4. **Constraints / status checks**: QA uniqueness per (project, gate) and status values; `worker_expenses`, `subcontractor_invoices`, `quotes`, `invoices`, `variations`, `handover_records`, `snags`.
5. **`people`** column grants and any views over it.
6. **Remaining policy details**: `documents` INSERT/UPDATE `WITH CHECK`; `project_commercials` write policy; `profiles` columns/UPDATE scope; `technical_systems` SELECT `TO` role.
7. **Auth**: current public sign-up state.
8. **Rebuild**: full migration history with statements (or schema-only dump) and whether pre-6-October foundation objects are included.

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
