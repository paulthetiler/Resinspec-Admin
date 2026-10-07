# ResinSpec Admin — Supabase database baseline

Status: **TASK #21 CLOSED (7 October 2026).** Final verdict below. Baseline not yet captured into the repository; six evidence items remain as non-blocking follow-up.

The live Supabase project (`vsizfxdtmlxygjnlcztf`, eu-west-2) holds the schema,
RLS policies, triggers, RPCs, storage buckets/policies and three Edge Functions.
None of these have ever been committed to this repository. The audit session
that created this folder had only the public publishable key, which cannot read
schema or policy definitions. Live facts below were confirmed separately through
the Supabase connector by the project owner.

## TASK #21 final verdict

**Verdict: the database security boundary is substantially in place, but it does not enforce ResinSpec's business workflow. One proven access-control vulnerability needs immediate action, and the database cannot be rebuilt from this repository.**

- Roles, commercial isolation, notification isolation, Owner-only role/system administration, private storage and the Edge Functions are controlled at database level.
- The 8-gate QA workflow, snag acceptance, pre-start release, handover progression and expense/CIS payment states are enforced only in Next.js server actions. Any user with project access can bypass them through the Supabase API. Changes are audited, not prevented.
- Public self-sign-up, combined with the `auth.users` bootstrap trigger, lets whoever controls an assigned person's mailbox inherit that person's project access without Owner-issued access.
- Sensitive people data (NI/UTR/CIS) and Supervisor storage reads are broader than intended.
- No schema, migrations, policies, functions, storage policies or Edge Function source are in source control.

All findings are proven from live definitions and policy text supplied read-only via the Supabase connector, plus anonymous probing. No behaviour was executed against production, no test users were created, and no live data was modified or exported.

### Remediation priority (proven findings)

| Priority | # | Finding | Remediation direction (not implemented) |
| --- | --- | --- | --- |
| **P0 Immediate** | 1 | Public self-sign-up + `resinspec_auth_user_created` → `bootstrap_auth_user` links by email (no `active` check) and inherits the person's project assignments via `can_access_project` | Disable public sign-up now (Auth setting; Owner-issued logins via `admin-create-user` are unaffected). Then stop auto-linking on sign-up, or require Owner-issued/active people. |
| **P1 High** | 2 | 8-gate QA state machine not enforced at database level (`qa_records` INSERT/UPDATE = project access; audit trigger only) | TASK #23: DB-side transition rules (trigger or SECURITY DEFINER RPC) for order, completion-before-acceptance, evidence, reviewer role, completer ≠ reviewer, accepted-gate immutability; narrow direct UPDATE |
| P1 High | 3 | `snags`, `site_readings`, `batch_logs` writable by any project-access user; Installers can self-accept snags (defeats Gate 8) | Restrict status/acceptance columns to reviewers; lock evidence rows once the dependent gate is accepted |
| P1 High | 4 | Pre-start and handover business-state rules not database-enforced (audit triggers only) | Validate pre-start readiness and handover progression (QA released, snags accepted) server-side in the database |
| P1 High | 5 | `people` NI/UTR/CIS/status fields readable by Office, Commercial, Supervisor (not project-scoped for Supervisor) | Move sensitive fields to a restricted table or revoke column grants; expose via role-checked view/RPC |
| P1 High | 6 | Supervisor can read `worker-receipts` and `site-issues` objects for unassigned projects | Add project-access condition (`can_access_project(storage_project_id(name))`) to the Supervisor branch |
| P1 High | 7 | Assignment end dates do not revoke project access (`can_access_project` ignores `starts_on`/`ends_on`) | Honour assignment dates in `can_access_project` (and treat inactive people as unassigned) |
| P1 High | 8 | Leaked Password Protection disabled | Enable in Auth settings |
| P1 High | 9 | Live database cannot be rebuilt from the repository | Run `scripts/capture-db-baseline.sh` with a read-only role; commit schema, policies, functions, triggers, storage config and Edge Function source; record Auth config |
| P2 Medium | 10 | Expense / CIS invoice status transitions not enforced (management UPDATE allows e.g. `pending`/`rejected` → `paid`, amount edits) | Transition rules in DB; lock rows once paid |
| P3 Low | 11 | `get_user_role` discloses any user's role to any authenticated user (INVOKER; effective reach pending `user_roles` policies) | Restrict to Owner/self or revoke from `authenticated` |
| P3 Low | 12 | Functional app↔DB mismatches: Office/Commercial handover controls fail at submit; Commercial can update CIS invoices in DB but not in app; notifications accept arbitrary `href`; assignment-only storage uploads block unassigned Owner/Office | Align app permissions and policies; constrain `href` to relative paths |

Related operational defect confirmed (not security): `approve_technical_system` retires the prior revision, which breaks pre-start/Gate 4 checks on live jobs still using it (see first audit).

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

## Verified trigger attachments (fifth evidence set, 7 October 2026)

| Table | Trigger(s) | Purpose |
| --- | --- | --- |
| `auth.users` | `resinspec_auth_user_created` AFTER INSERT → `private.bootstrap_auth_user()` | profile + people link/creation on account creation |
| `qa_records` | `audit_qa_records` AFTER INSERT/UPDATE/DELETE → `private.audit_row_change('project_id')` | **audit only**; no workflow enforcement |
| `documents` | project/QA match BEFORE INSERT/UPDATE; project/survey match BEFORE INSERT/UPDATE; audit AFTER INSERT/UPDATE/DELETE | integrity + audit |
| `estimate_items` | INSERT/UPDATE/DELETE → estimate total roll-up | calculation |
| `estimates` | UPDATE → header roll-up; audit | calculation + audit |
| `quotes` | UPDATE → `quote_status_transition`; audit | lifecycle + audit |
| `variations` | INSERT/UPDATE/DELETE → commercial roll-up; audit | calculation + audit |
| `invoices` | INSERT/UPDATE/DELETE → commercial roll-up; audit | calculation + audit |
| `prestart_releases`, `handover_records`, `snags`, `site_readings`, `batch_logs` | audit only | no workflow enforcement |
| `projects`, `project_assignments`, `project_commercials`, `rams_*`, `surveys`, `technical_systems` | audit | audit |

## Verified function EXECUTE grants (sixth evidence set, 7 October 2026)

| Function | anon | authenticated | public | Internal guard |
| --- | --- | --- | --- | --- |
| `public.approve_technical_system(uuid)` | no | yes | no | requires Owner (`has_role`) |
| `public.set_user_role(...)` | no | yes | no | requires Owner (`private.is_owner()`) |
| `public.current_app_role()` | no | yes | no | caller's own role |
| `public.get_user_role(uuid)` | no | yes | no | **none** |
| `private.is_owner()` | no | yes | no | caller's own role |
| `can_access_project`, `can_manage_project`, `can_view_commercial`, `current_user_role`, `has_role`, `storage_project_id` | executable | executable | executable | evaluate caller's context only; grant no table access by themselves |
| `audit_row_change`, `bootstrap_auth_user`, `commercial_rollup_trigger`, `estimate_header_rollup_trigger`, `estimate_item_rollup_trigger`, `quote_status_transition`, `refresh_estimate_totals`, `refresh_project_commercial_rollup` | no | no | no | trigger/internal only |

## Audit classification (sixth evidence set, 7 October 2026)

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
- `set_user_role` and `approve_technical_system` are callable by authenticated users but enforce Owner inside the function; not callable by `anon`.
- Trigger and roll-up functions (including `bootstrap_auth_user`, `quote_status_transition`, roll-ups, `audit_row_change`) are not directly executable by `anon` / `authenticated` / `public`.
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

Database mechanisms proven wired (structural level; not every business transition proven correct):
- `estimate_items` changes recalculate estimate totals; `estimates` header changes (contingency/margin) recalculate.
- `quotes` UPDATE invokes `quote_status_transition` (issued → quoted; accepted → won, estimate accepted, values to `project_commercials`).
- `variations` and `invoices` changes invoke the `project_commercials` roll-up.
- `documents` BEFORE triggers prevent QA- or survey-linked documents from belonging to another project.
- Audit triggers record changes on QA, pre-start, handover, snags, readings, batches, projects, assignments, commercials, RAMS, surveys, technical systems, quotes, estimates, variations, invoices and documents (they record; they do not prevent).

### PROVEN VULNERABILITIES / DESIGN GAPS

(Numbering here is by discovery; see the remediation priority table above for ranking.)


1. **PROVEN ACCESS-CONTROL VULNERABILITY: self-sign-up inherits project access (immediate remediation: disable public sign-up).** Chain, all verified:
   1. a `people` row has an email, `user_id IS NULL`, and a `project_assignments` row via `person_id`;
   2. someone signs up through public Auth sign-up (`disable_signup: false`) with that email;
   3. `auth.users` AFTER INSERT fires `resinspec_auth_user_created`;
   4. `bootstrap_auth_user` (SECURITY DEFINER) matches the `people` row by case-insensitive email and sets `people.user_id = new.id`, with no `people.active` check;
   5. `can_access_project` then returns true via `project_assignments.person_id → people.user_id = auth.uid()`;
   6. no active ResinSpec role is needed for that assignment-based access.

   Whoever controls that person's mailbox obtains the person's project access (QA/readings/batches/snags writes, project documents and approved RAMS, site issues, survey reads) without an Owner-issued login or role. Inactive people are included. The app UI would route such a user to `/unauthorised`, but the REST API applies RLS only. Not fixed in this branch.
2. **PROVEN DATABASE INTEGRITY / ACCESS-CONTROL GAP: QA state machine not enforced (→ TASK #23).** `qa_records` INSERT/UPDATE = `can_access_project`, and the only trigger is `audit_qa_records` (audit only). Nothing at database level enforces gate order, completion before acceptance, photo/reading/batch evidence, Owner/Supervisor reviewer authority, completer ≠ reviewer, or accepted-gate immutability. Assigned Installers/Supervisors and all Office/Commercial users can set any gate status directly. Changes are audited, not prevented.
3. **QA evidence tables writable by any project-access user (no enforcement triggers, audit only).** `site_readings`, `batch_logs`, `snags`: readings/batches satisfying Gates 4/6 can be edited after the fact; an Installer can set a snag `accepted`, defeating the Gate 8 check.
4. **Handover and pre-start state not enforced at database level.** `handover_records` and `prestart_releases` carry audit triggers only. O/Of/C/S (with access) can write any handover status; Owner/Supervisor can write a `released` pre-start row whether or not the readiness checks pass.
5. **Expense / CIS status transitions not encoded in RLS.** Management UPDATE allows any transition (e.g. `pending`/`rejected` → `paid`) and amount edits; constraint evidence still pending.
6. **People tax/identity fields readable by Office, Commercial, Supervisor** (same row, authenticated column grants). Supervisor reads are not project-scoped by the `people` policy.
7. **Storage privacy: Supervisor cross-project reads.** `worker-receipts` and `site-issues` read policies allow the Supervisor role with no project-access condition (exact policy text confirmed). A Supervisor can read receipt and issue-photo objects for unassigned jobs if paths are known or listable. `cis-invoices` does not include Supervisor.
8. **Public email sign-up enabled** (`disable_signup: false`, last checked 7 Oct). Now an access-control issue in combination with the auth trigger (finding 1), not only a configuration weakness.
9. **Leaked Password Protection disabled.**
10. **Database not reproducible from the repository.**
11. **Low-severity information disclosure: `get_user_role`.** Executable by every authenticated user; body returns the active role for any supplied `target_user_id` with no Owner, management, self or project check. Any authenticated user who knows another user's UUID can learn that user's ResinSpec role. It cannot modify roles. Caveat: the function is SECURITY INVOKER, so the effective result also depends on the caller's SELECT access to `private.user_roles` (outstanding item 1); if that table only exposes the caller's own row, the disclosure would be limited in practice.

### Operational consequence confirmed (not security)

- `approve_technical_system` retires the previously approved revision with the same code. Live jobs still pointing at the retired revision then fail the pre-start "approved system" check and the Gate 4 `status = 'approved'` check in the app, and their pre-start snapshot goes stale (see first audit, pre-start deadlock).
- Assignment expiry is not considered by `can_access_project`: an assigned Supervisor/Installer retains database project access until the assignment row is removed, regardless of `starts_on` / `ends_on`.

### Application ↔ database mismatches (functional)

- Handover/snag acceptance: RLS allows Office/Commercial; server actions require `qa:complete`, which they lack.
- `subcontractor_invoices` UPDATE allows Commercial; the app gives `invoices:review` to Office only.
- `user_notifications` INSERT lets Office/Commercial send any user a notification with an arbitrary `href` (rendered as a link). Low risk.
- Storage uploads to `worker-receipts` / `site-issues` / `cis-invoices` require an **assignment**, not `can_access_project`; Owner/Office/Commercial without an assignment cannot upload there even though the app offers them the forms where they hold submit permissions.

### UNVERIFIED FOLLOW-UP ITEMS (non-blocking)

- `private.user_roles` grants and RLS (also governs whether INVOKER helpers work and whether rows can be self-written).
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

## Follow-up evidence (non-blocking; TASK #21 closed without it)

1. **`private.user_roles`**: table grants and RLS policies (also settles the effective reach of `get_user_role`).
2. **Constraints / status CHECKs**: QA uniqueness per (project, gate) and status values; `worker_expenses`, `subcontractor_invoices`, `quotes`, `invoices`, `variations`, `handover_records`, `snags`.
3. **`people`** column grants and any views over it.
4. **Remaining policy details**: `documents` INSERT/UPDATE `WITH CHECK`; `project_commercials` write policy; `profiles` columns/UPDATE scope; `technical_systems` SELECT `TO` role.
5. **Auth**: current public sign-up setting.
6. **Rebuild**: full migration history with statements (or schema-only dump) and whether pre-6-October foundation objects are included.

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
