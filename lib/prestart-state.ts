// Pure pre-start release state model (no I/O), shared by the pre-start page,
// QA actions and the site workflow. The database is the source of truth for
// the snapshot (private.prestart_snapshot) and for release integrity; this
// module only interprets what the database returns.

export type PrestartSnapshot = Record<string, unknown>;

export type PrestartReleaseRow = {
  id: string;
  project_id?: string;
  status: string;
  snapshot: PrestartSnapshot | null;
  release_note: string | null;
  released_by: string | null;
  released_at: string | null;
  superseded_at?: string | null;
  superseded_by?: string | null;
  withdrawn_at?: string | null;
  withdrawn_by?: string | null;
  withdrawn_reason?: string | null;
};

export type PrestartReleaseState = "none" | "current" | "stale" | "withdrawn";

/** Project statuses in which a pre-start release may be issued or re-issued. */
export const RELEASE_ALLOWED_STATUSES = ["won", "prestart", "live"] as const;

/** Owner, or a Supervisor (the database additionally requires assignment). */
export function canReleasePrestart(role: string | null | undefined) {
  return role === "owner" || role === "supervisor";
}

export const SNAPSHOT_GROUPS: ReadonlyArray<{ label: string; fields: string[] }> = [
  { label: "Technical survey", fields: ["survey_id", "survey_updated_at"] },
  { label: "Technical system / revision", fields: ["system_id", "system_updated_at"] },
  { label: "RAMS revision", fields: ["rams_id", "rams_updated_at"] },
  { label: "Site record", fields: ["site_id", "site_updated_at"] },
  { label: "Programme dates", fields: ["programme_start", "programme_end"] },
  { label: "Floor area", fields: ["area_m2"] },
  { label: "Scope", fields: ["scope_summary"] },
  { label: "Crew allocation", fields: ["crew_count", "crew_fingerprint"] },
];

const UNVERIFIED_SNAPSHOT = "snapshot";

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

/**
 * Snapshot fields whose value differs between the released snapshot and the
 * current inputs. A release without a snapshot (legacy row that could not be
 * converted) is treated as changed so it is never trusted.
 */
export function changedSnapshotFields(
  released: PrestartSnapshot | null | undefined,
  current: PrestartSnapshot | null | undefined
): string[] {
  if (!released || !current) return [UNVERIFIED_SNAPSHOT];
  const keys = new Set([...Object.keys(released), ...Object.keys(current)]);
  return [...keys].filter((key) => !sameValue(released[key], current[key])).sort();
}

/** Human-readable list of what changed, in a stable order. */
export function describeChanges(fields: string[]): string[] {
  if (fields.includes(UNVERIFIED_SNAPSHOT)) {
    return ["Release snapshot could not be verified"];
  }
  const labels = SNAPSHOT_GROUPS.filter((group) =>
    group.fields.some((field) => fields.includes(field))
  ).map((group) => group.label);
  const known = new Set(SNAPSHOT_GROUPS.flatMap((group) => group.fields));
  const unknown = fields.filter((field) => !known.has(field));
  return unknown.length > 0 ? [...labels, ...unknown] : labels;
}

/** QA has begun once any gate has moved past `open`. */
export function isQaStarted(qaStatuses: ReadonlyArray<string>) {
  return qaStatuses.some((status) => status !== "open");
}

export type DerivedPrestartState = {
  state: PrestartReleaseState;
  /** The active (status = released) release, if any. */
  active: PrestartReleaseRow | null;
  /** Most recent release of any status. */
  latest: PrestartReleaseRow | null;
  changedFields: string[];
  changes: string[];
  /** Work has started on site (QA progressed or project live). */
  liveWork: boolean;
  /** Live work, QA not yet complete, and no current release: progression stops. */
  onHold: boolean;
  releaseCurrent: boolean;
  releaseStale: boolean;
};

function releasedAtValue(row: PrestartReleaseRow) {
  return row.released_at ? Date.parse(row.released_at) || 0 : 0;
}

export function derivePrestartState(input: {
  releases: ReadonlyArray<PrestartReleaseRow>;
  currentSnapshot: PrestartSnapshot | null;
  qaStatuses: ReadonlyArray<string>;
  projectStatus: string | null | undefined;
  /** Every QA gate released: pre-start changes no longer gate the job. */
  qaComplete?: boolean;
}): DerivedPrestartState {
  const ordered = [...input.releases].sort(
    (a, b) => releasedAtValue(b) - releasedAtValue(a)
  );
  const active = ordered.find((row) => row.status === "released") ?? null;
  const latest = ordered[0] ?? null;

  let state: PrestartReleaseState = "none";
  let changedFields: string[] = [];

  if (active) {
    changedFields = changedSnapshotFields(active.snapshot, input.currentSnapshot);
    state = changedFields.length > 0 ? "stale" : "current";
  } else if (latest) {
    state = "withdrawn";
  }

  const liveWork =
    isQaStarted(input.qaStatuses) || input.projectStatus === "live";

  return {
    state,
    active,
    latest,
    changedFields,
    changes: describeChanges(changedFields),
    liveWork,
    onHold: liveWork && !input.qaComplete && state !== "current",
    releaseCurrent: state === "current",
    releaseStale: state === "stale",
  };
}

/**
 * Why the caller may not (re-)release now, or null when release is allowed.
 * Deliberately independent of QA progress: a progressed Gate 1 never blocks a
 * re-release (this was the pre-TASK #23 deadlock).
 */
export function releaseBlockReason(input: {
  role: string | null | undefined;
  projectStatus: string | null | undefined;
  failedChecks: ReadonlyArray<string>;
}): string | null {
  if (!canReleasePrestart(input.role)) {
    return "Owner or assigned Supervisor authority is required to release pre-start";
  }
  if (
    !RELEASE_ALLOWED_STATUSES.includes(
      input.projectStatus as (typeof RELEASE_ALLOWED_STATUSES)[number]
    )
  ) {
    return "Pre-start can only be released while the project is Won, Pre-start or Live";
  }
  if (input.failedChecks.length > 0) {
    return `Pre-start is blocked: ${input.failedChecks.join(", ")}`;
  }
  return null;
}

/**
 * Why QA may not progress (complete / accept / mark N/A a gate), or null.
 * Applies to every gate: completed QA is never deleted, but no further gate
 * may be completed or released against a stale, withdrawn or missing release.
 */
export function qaProgressionBlockReason(input: {
  state: PrestartReleaseState;
  changes: ReadonlyArray<string>;
  gateOrder: number | null;
}): string | null {
  if (input.state === "current") return null;
  if (input.state === "stale") {
    return `QA is on hold: pre-start inputs changed since release (${input.changes.join(", ")}). Re-release pre-start before continuing.`;
  }
  if (input.state === "withdrawn") {
    return "QA is on hold: the pre-start release was withdrawn. Issue a new pre-start release before continuing.";
  }
  return input.gateOrder === 1
    ? "Gate 1 is locked until the current job inputs have a valid Pre-start release"
    : "QA is locked until the job has a valid Pre-start release";
}
