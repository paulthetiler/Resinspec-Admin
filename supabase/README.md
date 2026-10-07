# ResinSpec Admin — Supabase database baseline

Status: **baseline NOT yet captured** (7 October 2026).

The live Supabase project (`vsizfxdtmlxygjnlcztf`, eu-west-2) holds the schema,
RLS policies, triggers, RPCs, storage buckets/policies and the
`admin-create-user` Edge Function. None of these have ever been committed to
this repository. The audit session that created this folder had only the public
publishable key, which cannot read schema or policy definitions, so the capture
step below still has to be run by someone with read access.

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
