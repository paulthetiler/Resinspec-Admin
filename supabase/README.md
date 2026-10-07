# ResinSpec Admin — Supabase database baseline

Status: **baseline NOT yet captured; RLS + storage policies reviewed; functions/triggers/constraints pending; TASK #21 open** (7 October 2026).

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

## Audit classification (third evidence set, 7 October 2026)

Evidence: anonymous probe plus read-only extracts supplied by the owner via the
Supabase connector. No test users created; no live data modified.
"PROVEN" below means proven from policy text; behaviour was not executed.

### PROVEN SAFE

Anonymous / platform:
- Unauthenticated REST reads return 0 rows on all 33 app tables; buckets/objects not listable; `current_app_role` not executable by `anon`.
- All four buckets private.
- `admin-create-user` enforces authenticated user + `owner` internally (despite `verify_jwt = false`).
- `bootstrap-owner` disabled (HTTP 410, no action).
- `resinspec-mcp` is OAuth-protected and runs in the caller's RLS context (tool reach = caller's RLS rights).

RLS:
- Installers cannot update their own `worker_expenses` or `subcontractor_invoices` after submission; Supervisors cannot update expenses.
- Expenses / CIS invoices can only be inserted as oneself; Installers see only their own rows.
- `user_notifications`: users read and update only their own rows; the update cannot reassign `user_id`.
- Commercial isolation: `project_commercials`, `estimates`, `invoices`, `variations` need commercial visibility; `people_commercials` O/C only; `quotes` O/Of/C.
- `prestart_releases` writable only by Owner/Supervisor.
- Draft/superseded controlled documents and unapproved RAMS are not readable by Installers (table and storage).
- `technical_systems` writes Owner-only.
- RAMS and document acknowledgements can only be created for oneself.
- Storage uploads are bound to the project in the path; no UPDATE/DELETE route on `worker-receipts`, `site-issues`, `cis-invoices` objects for ordinary users (as supplied).

### PROVEN VULNERABILITY / DESIGN-INTEGRITY GAP

1. **QA workflow not encoded in RLS (→ TASK #23).** `qa_records` INSERT/UPDATE = any project-access user. RLS does not enforce sequence, status transitions, completion-before-acceptance, evidence, Owner/Supervisor-only acceptance, completer ≠ reviewer, or immutability of accepted gates. Trigger evidence still outstanding, so whether anything below RLS compensates is not yet known.
2. **QA evidence tables open to any project-access user.** `site_readings`, `batch_logs`, `snags` INSERT/UPDATE = access. Readings and batch records that satisfy Gates 4 and 6 can be edited after the fact. An Installer can set a snag to `accepted` directly, defeating the Gate 8 "all snags accepted" check (the app reserves acceptance for O/Of/C/S).
3. **Handover state machine not encoded.** O/Of/C/S can write any `handover_records` status (e.g. `issued`/`accepted`) directly regardless of QA state.
4. **Expense / CIS status transitions not encoded in RLS.** Management UPDATE does not restrict `pending → paid`, `rejected → paid`, editing after payment, or amount changes (trigger/constraint evidence outstanding).
5. **People tax/identity fields readable by Office, Commercial, Supervisor.** `ni_number`, `utr`, `cis_*`, `status_outcome` on the same row as a SELECT policy covering O/Of/C/S, with authenticated column grants (pending: any view/column mechanism that narrows this).
6. **Cross-project storage reads for Supervisor (as supplied).** `worker-receipts` and `site-issues` read policies grant O/Of/C/S with no project condition, unlike the matching tables (`worker_expenses`, `site_issues`), which require project access. A Supervisor can read (and, via the same SELECT policy, list) receipt and issue photos for jobs they are not assigned to. Receipts can contain personal data. Confirm against the literal policy text.
7. **Public email sign-up enabled** (`disable_signup: false`, last checked 7 Oct, not confirmed changed). Self-registered users hold an authenticated session. Notably, the `technical_systems` SELECT branch "system is approved" carries no role condition as supplied, so a self-registered user with no ResinSpec role would be able to read all approved system data (mixing, coverage, limits). Exact exposure depends on the policy's `TO` role and on helper behaviour for role-less users.
8. **Leaked Password Protection disabled** (security advisor).
9. **Database not reproducible from the repository** (live migrations, foundation schema, policies, helpers, storage policies and Edge Function source absent).

### Application ↔ database mismatches (functional, not security)

- Handover / snag acceptance: RLS allows Office and Commercial, but the server actions require `qa:complete`, which they lack (UI shows the controls; submission silently redirects).
- `subcontractor_invoices` UPDATE allows Commercial; the app grants `invoices:review` to Office but not Commercial.
- `user_notifications` INSERT allows Commercial; harmless, but Office/Commercial can send any user a notification with an arbitrary `href` (rendered as a link on Alerts). Low risk; consider constraining `href` to relative paths later.
- Storage uploads to `worker-receipts` / `site-issues` / `cis-invoices` require the user to be **assigned** to the project. Owners and Office (who have `expenses:submit` / review roles but are not usually assigned) may be unable to upload there; depends on the assignment helper.

### UNVERIFIED

- Bodies and security properties (`SECURITY DEFINER`, `search_path`, behaviour for role-less users, use of assignment dates) of `can_access_project`, `can_manage_project`, `can_view_commercial`, `has_role`, `storage_project_id`, `current_app_role`, `get_user_role`, `set_user_role`, `approve_technical_system`.
- EXECUTE grants on those functions (can `authenticated` call `set_user_role` / `approve_technical_system` and are they Owner-gated inside?).
- Triggers and trigger functions (QA, prestart, handover, expense/CIS status, roll-ups, quote acceptance, audit, any on `auth.users`).
- Constraints: QA uniqueness per (project, gate) and status values; expense/CIS/quote/invoice/variation status checks.
- `people`: any view or column revoke over sensitive fields.
- `documents` INSERT/UPDATE `WITH CHECK` detail: can an Installer insert or update a document row directly with status `approved`?
- `profiles` UPDATE: whether `profiles` carries any authority-bearing column a user could self-edit.
- `project_commercials`, `estimates`, `invoices` write policies and whether manual UPDATE can overwrite roll-ups.
- Current Auth sign-up setting; `resinspec-mcp` OAuth clients/scopes.
- Rebuild evidence (full migration history with statements / schema dump).

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

1. Definitions and security properties (`SECURITY DEFINER`, `search_path`, owner) of `private.can_access_project`, `private.can_manage_project`, `private.can_view_commercial`, `private.has_role`, `private.storage_project_id`, `current_app_role`, `get_user_role`, `set_user_role`, `approve_technical_system`, including how they treat an authenticated user with no role.
2. EXECUTE grants on all of the above (to `anon`, `authenticated`, `public`).
3. Trigger list and trigger-function definitions (all `public` tables plus `auth.users`).
4. Constraints: QA uniqueness / status values; `worker_expenses`, `subcontractor_invoices`, `quotes`, `invoices`, `variations`, `handover_records`, `snags` status checks.
5. Views over `people` and column grants confirming (or narrowing) sensitive-column exposure.
6. Literal `storage.objects` read-policy text for `worker-receipts` and `site-issues` (to confirm or clear gap 6), plus the `technical_systems` SELECT policy's `TO` role (gap 7).
7. `documents` INSERT/UPDATE `WITH CHECK` clauses; `profiles` columns; `project_commercials` / `estimates` / `invoices` write policies.
8. Current Auth `disable_signup` value.
9. Rebuild evidence: full migration list with statements (or schema-only dump), and whether pre-6-October foundation objects are in migration history.

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
