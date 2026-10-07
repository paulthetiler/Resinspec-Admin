import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canReleasePrestart,
  changedSnapshotFields,
  derivePrestartState,
  describeChanges,
  qaProgressionBlockReason,
  releaseBlockReason,
  type PrestartReleaseRow,
  type PrestartSnapshot,
} from "../lib/prestart-state.ts";

const baseSnapshot: PrestartSnapshot = {
  survey_id: "s1",
  survey_updated_at: "2026-10-02T08:00:00.000000Z",
  system_id: "sys1",
  system_updated_at: "2026-09-20T10:00:00.000000Z",
  rams_id: "r1",
  rams_updated_at: "2026-10-03T08:00:00.000000Z",
  site_id: "site1",
  site_updated_at: "2026-10-01T09:00:00.000000Z",
  programme_start: "2026-10-20",
  programme_end: "2026-10-24",
  area_m2: "420",
  scope_summary: "Epoxy floor",
  crew_count: 2,
  crew_fingerprint: "abc",
};

function release(
  overrides: Partial<PrestartReleaseRow> = {}
): PrestartReleaseRow {
  return {
    id: "rel-1",
    status: "released",
    snapshot: { ...baseSnapshot },
    release_note: null,
    released_by: "user-supervisor",
    released_at: "2026-10-05T12:00:00Z",
    ...overrides,
  };
}

function derive(
  current: PrestartSnapshot,
  releases: PrestartReleaseRow[] = [release()],
  qaStatuses: string[] = [],
  projectStatus = "prestart"
) {
  return derivePrestartState({
    releases,
    currentSnapshot: current,
    qaStatuses,
    projectStatus,
  });
}

test("1. normal first release is current", () => {
  const state = derive({ ...baseSnapshot });
  assert.equal(state.state, "current");
  assert.equal(state.releaseCurrent, true);
  assert.equal(state.onHold, false);
  assert.equal(
    releaseBlockReason({ role: "supervisor", projectStatus: "won", failedChecks: [] }),
    null
  );
});

test("no release yet is 'none' and blocks QA", () => {
  const state = derive({ ...baseSnapshot }, []);
  assert.equal(state.state, "none");
  assert.match(
    qaProgressionBlockReason({ state: state.state, changes: [], gateOrder: 1 }) ?? "",
    /Gate 1 is locked/
  );
});

test("2. unchanged inputs keep the release current", () => {
  const state = derive({ ...baseSnapshot });
  assert.deepEqual(state.changedFields, []);
  assert.equal(
    qaProgressionBlockReason({ state: state.state, changes: state.changes, gateOrder: 3 }),
    null
  );
});

test("3. crew change makes the release stale", () => {
  const state = derive({ ...baseSnapshot, crew_count: 3, crew_fingerprint: "def" });
  assert.equal(state.state, "stale");
  assert.deepEqual(state.changedFields, ["crew_count", "crew_fingerprint"]);
  assert.deepEqual(state.changes, ["Crew allocation"]);
});

test("4. programme, area and scope changes make the release stale", () => {
  assert.deepEqual(
    derive({ ...baseSnapshot, programme_start: "2026-10-21" }).changes,
    ["Programme dates"]
  );
  assert.deepEqual(
    derive({ ...baseSnapshot, area_m2: "450", scope_summary: "More" }).changes,
    ["Floor area", "Scope"]
  );
  assert.deepEqual(
    derive({ ...baseSnapshot, site_updated_at: "2026-10-06T09:00:00.000000Z" }).changes,
    ["Site record"]
  );
  assert.deepEqual(
    derive({ ...baseSnapshot, survey_updated_at: "2026-10-06T09:00:00.000000Z" }).changes,
    ["Technical survey"]
  );
});

test("5. RAMS revision makes the release stale", () => {
  const state = derive({ ...baseSnapshot, rams_id: "r2", rams_updated_at: "2026-10-06T00:00:00.000000Z" });
  assert.equal(state.state, "stale");
  assert.deepEqual(state.changes, ["RAMS revision"]);
});

test("6. technical system revision makes the release stale", () => {
  const retired = derive({ ...baseSnapshot, system_updated_at: "2026-10-06T00:00:00.000000Z" });
  assert.deepEqual(retired.changes, ["Technical system / revision"]);
  const newRevision = derive({ ...baseSnapshot, system_id: "sys2" });
  assert.equal(newRevision.state, "stale");
});

test("7. a stale release can be legitimately re-released", () => {
  const stale = derive({ ...baseSnapshot, crew_count: 3 });
  assert.equal(stale.state, "stale");
  assert.equal(
    releaseBlockReason({ role: "owner", projectStatus: "prestart", failedChecks: [] }),
    null
  );
  // The re-release becomes the active row with the new snapshot.
  const rereleased = derive({ ...baseSnapshot, crew_count: 3 }, [
    release({ id: "rel-1", status: "superseded" }),
    release({
      id: "rel-2",
      released_at: "2026-10-06T12:00:00Z",
      snapshot: { ...baseSnapshot, crew_count: 3 },
    }),
  ]);
  assert.equal(rereleased.state, "current");
  assert.equal(rereleased.active?.id, "rel-2");
});

test("8. old releases remain in history and are not treated as active", () => {
  const releases = [
    release({ id: "rel-1", status: "superseded", released_at: "2026-10-05T12:00:00Z" }),
    release({ id: "rel-2", status: "superseded", released_at: "2026-10-06T12:00:00Z" }),
    release({ id: "rel-3", released_at: "2026-10-07T12:00:00Z" }),
  ];
  const state = derive({ ...baseSnapshot }, releases);
  assert.equal(state.active?.id, "rel-3");
  assert.equal(state.latest?.id, "rel-3");
  assert.equal(releases.length, 3);
});

test("9. Gate 1 progress never blocks a re-release (no deadlock)", () => {
  const state = derive(
    { ...baseSnapshot, programme_end: "2026-10-30" },
    [release()],
    ["accepted", "accepted", "complete", "open"],
    "live"
  );
  assert.equal(state.state, "stale");
  // Release permission depends only on role, project status and readiness.
  assert.equal(
    releaseBlockReason({ role: "supervisor", projectStatus: "live", failedChecks: [] }),
    null
  );
});

test("10. live job material change puts QA on hold without touching completed QA", () => {
  const qaStatuses = ["accepted", "accepted", "complete", "open"];
  const state = derive({ ...baseSnapshot, rams_id: "r2" }, [release()], qaStatuses, "prestart");
  assert.equal(state.liveWork, true);
  assert.equal(state.onHold, true);
  const reason = qaProgressionBlockReason({ state: state.state, changes: state.changes, gateOrder: 4 });
  assert.match(reason ?? "", /on hold.*RAMS revision/);
  // The model never rewrites QA history.
  assert.deepEqual(qaStatuses, ["accepted", "accepted", "complete", "open"]);

  const withdrawn = derive({ ...baseSnapshot }, [release({ status: "withdrawn" })], qaStatuses);
  assert.equal(withdrawn.state, "withdrawn");
  assert.equal(withdrawn.onHold, true);

  const notStarted = derive({ ...baseSnapshot, rams_id: "r2" }, [release()], ["open", "open"]);
  assert.equal(notStarted.onHold, false, "not on hold before site work starts");
});

test("11. unauthorised roles cannot release or re-release", () => {
  for (const role of ["office", "commercial", "installer", null, undefined]) {
    assert.equal(canReleasePrestart(role), false, String(role));
    assert.match(
      releaseBlockReason({ role, projectStatus: "prestart", failedChecks: [] }) ?? "",
      /authority is required/
    );
  }
  assert.equal(canReleasePrestart("owner"), true);
  assert.equal(canReleasePrestart("supervisor"), true);
});

test("release is refused outside won / prestart / live or with failed checks", () => {
  assert.match(
    releaseBlockReason({ role: "owner", projectStatus: "handover", failedChecks: [] }) ?? "",
    /Won, Pre-start or Live/
  );
  assert.match(
    releaseBlockReason({ role: "owner", projectStatus: "won", failedChecks: ["RAMS approved"] }) ?? "",
    /blocked: RAMS approved/
  );
});

test("a release without a verifiable snapshot is never trusted", () => {
  assert.deepEqual(changedSnapshotFields(null, baseSnapshot), ["snapshot"]);
  const state = derive({ ...baseSnapshot }, [release({ snapshot: null })]);
  assert.equal(state.state, "stale");
  assert.deepEqual(describeChanges(state.changedFields), [
    "Release snapshot could not be verified",
  ]);
});

test("completed QA is never put on hold by a later pre-start change", () => {
  const state = derivePrestartState({
    releases: [release()],
    currentSnapshot: { ...baseSnapshot, programme_end: "2026-11-30" },
    qaStatuses: Array(8).fill("accepted"),
    projectStatus: "handover",
    qaComplete: true,
  });
  assert.equal(state.state, "stale");
  assert.equal(state.onHold, false);
});
