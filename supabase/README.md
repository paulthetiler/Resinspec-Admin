# ResinSpec Admin — Supabase database baseline

Status: **baseline NOT yet captured; policy evidence pending** (7 October 2026).

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
| Edge Function `bootstrap-owner` | active, `verify_jwt = true` (not referenced anywhere in app code) |
| Edge Function `admin-create-user` | active, **`verify_jwt = false`** (called from `components/person-access-control.tsx`) |
| Edge Function `resinspec-mcp` | active, **`verify_jwt = false`** (not referenced in app code; appears to back the OAuth/ChatGPT connection in `app/oauth/consent`) |

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

## Audit classification (current)

PROVEN SAFE (anonymous boundary only):

- Unauthenticated REST reads return 0 rows on all 33 app tables (RLS enabled; anon still holds SELECT grants).
- Unauthenticated callers cannot list storage buckets or objects in the four app buckets.
- Unauthenticated callers cannot execute `current_app_role` (`42501`).

PROVEN VULNERABILITY / MISCONFIGURATION:

- Public email sign-up enabled (`disable_signup: false`, re-checked 7 Oct). Any confirmed mailbox can obtain an authenticated session. Impact depends on policies (unverified).
- Leaked password protection disabled (advisor).
- Database structure not reproducible from this repository (no migrations, policies, functions, storage config or Edge Function source committed).

UNVERIFIED, raised priority by the confirmed facts:

- `admin-create-user` with `verify_jwt = false`: the gateway does not check the caller, so the function's own code must verify a valid JWT **and** Owner role before using its service-role client. Source needed.
- `resinspec-mcp` with `verify_jwt = false`: a public endpoint; must validate OAuth/JWT itself and act with the caller's RLS context, not service role. Source needed.
- `bootstrap-owner` still active with `verify_jwt = true`: combined with open sign-up, any self-registered user can call it. It must refuse once an owner exists. Source needed.

UNVERIFIED (policy-dependent; "RLS enabled" does not establish correctness):

- access for an authenticated user with no ResinSpec role
- cross-project isolation for Supervisor / Installer
- people tax fields (`ni_number`, `utr`, `cis_*`, `status_outcome`) exposure to Supervisor / Office / Commercial
- `people_commercials`, `project_commercials`, `estimates`, `invoices`, `variations` restriction to Owner / Commercial
- direct API writes to `qa_records`, `prestart_releases`, `snags`, `handover_records`
- `worker_expenses` / `subcontractor_invoices` status transitions and other users' rows
- `user_notifications` cross-user read/insert
- storage policies for `project-documents`, `worker-receipts`, `site-issues`, `cis-invoices`
- Owner enforcement inside `set_user_role`, `get_user_role`, `approve_technical_system`
- database-side roll-ups and quote-acceptance trigger claimed in `docs/architecture.md`

This folder contains the tooling to capture the baseline safely and the evidence
gathered so far.

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

## Evidence still required to finish TASK #21

Read-only extractions (the queries in `supabase/audit/catalog_inventory.sql`
can be run section by section through the connector; omit the psql-only lines
starting with `\` and the `begin` / `rollback` wrapper):

1. Complete migration list **with statements** (`supabase_migrations.schema_migrations`), or a schema-only dump.
2. All RLS policies: `pg_policies` for `public` and `storage` (section 6).
3. Function definitions, `SECURITY DEFINER` flag and `search_path` (section 9), especially `current_app_role`, `get_user_role`, `set_user_role`, `approve_technical_system`, any project-access helper, and all trigger functions.
4. EXECUTE grants on those functions to `anon` / `authenticated` (section 10).
5. Triggers (section 11), including any on `auth.users`.
6. Table and column grants to `anon` / `authenticated` (sections 7–8), especially `people`.
7. Constraints and check constraints (section 3): status enums/checks, uniqueness of QA gates per project, FKs.
8. Storage bucket configuration (section 13) plus `storage.objects` policies (in section 6).
9. Source of the three Edge Functions, plus the **names** (not values) of the secrets each uses.
10. Auth configuration: current sign-up setting, OAuth server clients/scopes, password policy.
11. `private.user_roles` (or wherever roles live) definition and its policies.

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
