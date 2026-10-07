# Pre-start / live-job state model (TASK #23)

## Before TASK #23 (as found)

- `prestart_releases` held **one row per project** (`upsert … onConflict: project_id`).
  Re-releasing overwrote the previous release; reopening set it back to `draft`.
  There was no release history.
- The snapshot (survey, system, RAMS, site timestamps; programme; area; scope;
  crew count + JSON crew fingerprint) was computed and written **by the app**.
  The database accepted whatever the caller sent: an Owner/Supervisor could
  write a `released` row through the API with any snapshot, whether or not the
  readiness checks passed.
- `lib/prestart.ts` compared that row with live data. Any difference made the
  release "stale".
- QA Gate 1 completion required a current release. Later gates did not check
  the release.

### Deadlock / staleness paths

1. `releasePrestart` and `reopenPrestart` both called
   `assertPrestartStillEditable`, which refused **any** release or reopen once
   QA Gate 1 had moved past `open`.
2. `releasePrestart` also refused unless the project status was `won` or `prestart`.
3. After site work began, any routine change made the release stale:
   - adding or removing crew, or changing assignment dates;
   - extending the programme;
   - editing the site or survey;
   - approving a RAMS revision;
   - approving a new technical-system revision, which retires the old one.
4. Because of (1) and (2), the stale release could then never be replaced.
   The job page kept showing "Re-release pre-start" as the dominant next action,
   which was impossible, and Installation QA showed as locked. QA gates 2–8
   still accepted completions against the stale release, so the hold was
   neither enforced nor resolvable.

## After TASK #23

### Data

- `prestart_releases` is an **append-only history**. Every release is a new row.
- Statuses:
  - `released`: the active release. A partial unique index allows at most one per project.
  - `superseded`: replaced by a later release; `superseded_by` and `superseded_at` record which and when.
  - `withdrawn`: reopened by an authorised person, with who, when and why. Legacy `draft` rows are migrated to `withdrawn`.
- The snapshot (`snapshot jsonb`) is computed by the database
  (`private.prestart_snapshot`) when the release row is inserted. Callers cannot
  supply or edit it.

### Definitions

| Term | Definition |
| --- | --- |
| **Current** | An active `released` row exists and its snapshot equals `private.prestart_snapshot(project)` now. |
| **Stale** | An active release exists but at least one snapshot field differs. The app lists what changed (survey, system/revision, RAMS revision, site record, programme dates, floor area, scope, crew allocation). A release without a verifiable snapshot is always stale. |
| **Withdrawn** | No active release; the latest release was withdrawn. |
| **None** | No release has ever been issued. |
| **Live work** | Any QA gate has moved past `open`, or the project status is `live`. |
| **On hold** | Live work and the release is not current (stale, withdrawn or none). |

### Who can release, re-release or withdraw

- Owner on any project, or Supervisor on a project they are assigned to.
- Enforced three times: in the app (`canReleasePrestart`), by RLS, and by the
  `prestart_release_guard` trigger. Office, Commercial, Installer and users
  with no role are refused.
- A release can only be issued while the project is `won`, `prestart` or `live`,
  and only when every database readiness check passes
  (`private.prestart_blockers`):
  - authorised status;
  - client, site address, area and scope recorded;
  - valid programme;
  - survey released as suitable;
  - approved system assigned;
  - latest RAMS revision approved;
  - at least one crew assignment.
- Withdrawal requires a reason in the app.

### Database-enforced integrity (`prestart_release_guard`)

- INSERT:
  - status must be `released`;
  - authority is checked and readiness re-checked;
  - the snapshot, `released_by` and `released_at` are set by the database (forged values are ignored);
  - the previous active release becomes `superseded`.
- UPDATE:
  - snapshot and release metadata are immutable;
  - the only transitions are `released → superseded` (internal, by a new release) and `released → withdrawn` (authorised caller);
  - nothing returns to `released`.
- DELETE is always refused, so history is permanent.
- On the first release of a `won` project, the project moves to `prestart`.
  This is also done in the database, so any authorised writer behaves the same.

### Gate 1 and QA, without circular locking

- **Re-release never looks at QA.** It depends only on authority, project
  status and readiness. A progressed or accepted Gate 1 cannot block it.
- **QA depends on a current release, for every gate.** Completing a gate,
  accepting it or marking it N/A all require a current release. Rejection
  stays allowed, because it is protective.
- The dependency is one-way (QA → release), so there is no cycle.

### Material change on a live job

- The release becomes **stale** and the job is **on hold**:
  - the job page shows phase "On hold" and lists what changed;
  - the pre-start page shows a hold banner;
  - the QA page explains that progression is paused.
- Completed QA is never deleted or rewound, and project status is not changed.
- An authorised person resolves the changed prerequisites and issues a new
  release. The old release stays in history as `superseded`, and QA continues.

## Deployment order

The app now depends on the migration:
- it calls `prestart_current_inputs`;
- it reads multiple release rows;
- it inserts releases instead of upserting.

Apply `supabase/migrations/20261008090000_prestart_release_history.sql`
first, then deploy the app. Until the new app is deployed, the old app's upsert
fails safely: no unique constraint on `project_id` remains, so its upsert is
rejected.

## Tests

- `npm test`: unit tests for the state model (`tests/prestart-state.test.ts`).
- `npm run test:db`: applies the migration to a throwaway local Postgres
  loaded with a stub of the verified live schema plus a legacy release row,
  then asserts the database behaviour (`tests/db/prestart_release.test.sql`).
