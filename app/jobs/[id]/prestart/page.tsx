import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { getPrestartState, type PrestartCheckCode } from "@/lib/prestart";
import { canReleasePrestart, releaseBlockReason } from "@/lib/prestart-state";
import { releasePrestart, withdrawPrestart } from "./actions";

type PrestartPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    released?: string;
    withdrawn?: string;
  }>;
};

const CHECK_LINKS: Record<PrestartCheckCode, { href: string; label: string }> = {
  authorised: { href: "", label: "Open job" },
  site_scope: { href: "/edit", label: "Edit job" },
  programme: { href: "/edit", label: "Edit job" },
  survey: { href: "/survey", label: "Open survey" },
  system: { href: "/edit", label: "Assign system" },
  rams: { href: "/rams", label: "Open RAMS" },
  crew: { href: "/crew", label: "Assign crew" },
};

function localDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function PrestartPage({
  params,
  searchParams,
}: PrestartPageProps) {
  const { id } = await params;
  const { error, released, withdrawn } = await searchParams;
  const { supabase, role } = await requireAnyPermission([
    "jobs:view_all",
    "jobs:view_assigned",
  ]);

  const state = await getPrestartState(supabase, id);
  if (!state) notFound();

  const canRelease = canReleasePrestart(role);
  const releaseBlocked = releaseBlockReason({
    role,
    projectStatus: state.project.status,
    failedChecks: state.checks.filter((check) => !check.pass).map((check) => check.label),
  });

  const actorIds = Array.from(
    new Set(
      state.releases
        .flatMap((row) => [row.released_by, row.withdrawn_by])
        .filter((value): value is string => Boolean(value))
    )
  );
  const actorNames = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds);
    for (const profile of profiles || []) {
      actorNames.set(profile.id, profile.full_name || "Team member");
    }
  }
  const actorName = (id: string | null | undefined) =>
    id ? actorNames.get(id) || "Team member" : "—";

  const releasedCount = state.checks.filter((check) => check.pass).length;
  const controlStatus = state.onHold
    ? "on hold"
    : state.releaseCurrent
      ? "released"
      : state.releaseStale
        ? "stale"
        : state.releaseState === "withdrawn"
          ? "withdrawn"
          : "not released";

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{state.project.reference} · pre-start control</p>
          <h1>{state.project.title}</h1>
          <p>
            Installation cannot start until the commercial handoff, technical
            survey, system, RAMS, programme and crew are all ready.
          </p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" href={`/jobs/${id}/survey`}>
            Survey
          </Link>
          <Link className="secondary-button" href={`/jobs/${id}/qa`}>
            QA
          </Link>
          <Link className="secondary-button" href={`/jobs/${id}`}>
            Back to job
          </Link>
        </div>
      </section>

      {error ? <p className="form-error page-error">{error}</p> : null}
      {released ? (
        <p className="form-success page-error">
          Pre-start released. Gate 1 can now be completed when site works begin.
        </p>
      ) : null}
      {withdrawn ? (
        <p className="form-success page-error">
          Pre-start release withdrawn. It is kept in the release history; issue a new release before QA continues.
        </p>
      ) : null}

      <section className="detail-grid prestart-metrics">
        <article className="detail-card">
          <span>Readiness checks</span>
          <strong>
            {releasedCount} / {state.checks.length}
          </strong>
        </article>
        <article className="detail-card">
          <span>Control status</span>
          <strong className={`status-badge prestart-${controlStatus.replace(" ", "-")}`}>
            {controlStatus}
          </strong>
        </article>
        <article className="detail-card">
          <span>Project stage</span>
          <strong className="status-badge">{state.project.status}</strong>
        </article>
        <article className="detail-card">
          <span>Released</span>
          <strong>{localDateTime(state.release?.released_at)}</strong>
        </article>
      </section>

      {state.releaseStale || (state.onHold && !state.releaseCurrent) ? (
        <div className="prestart-stale-note">
          <strong>
            {state.onHold
              ? "Job on hold: the pre-start release no longer matches the job."
              : "Pre-start release is stale."}
          </strong>{" "}
          {state.releaseStale
            ? "These controlled inputs changed after the job was released:"
            : "The last pre-start release was withdrawn."}
          {state.releaseStale ? (
            <ul>
              {state.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          ) : null}
          <p>
            {state.onHold
              ? "Completed QA is kept, but no further QA gate can be completed or released until an Owner or assigned Supervisor re-checks the items below and issues a new release."
              : "Re-check the items below and issue a new release before starting installation."}
          </p>
        </div>
      ) : null}

      <section className="panel prestart-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Start-work gate</p>
            <h2>Pre-start readiness</h2>
          </div>
          <span className="count-badge">{releasedCount}</span>
        </div>

        <div className="prestart-check-list">
          {state.checks.map((check, index) => {
            const link = CHECK_LINKS[check.code];
            const href = `/jobs/${id}${link.href}`;

            return (
              <article
                className={`prestart-check ${check.pass ? "is-pass" : "is-blocked"}`}
                key={check.code}
              >
                <div className="prestart-check-number">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="prestart-check-copy">
                  <div>
                    <strong>{check.label}</strong>
                    <span className={`status-badge ${check.pass ? "" : "qa-rejected"}`}>
                      {check.pass ? "ready" : "blocked"}
                    </span>
                  </div>
                  <p>{check.detail}</p>
                </div>
                <Link className="text-button" href={href}>
                  {link.label}
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <div className="two-column prestart-release-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Release record</p>
              <h2>Current approval</h2>
            </div>
          </div>

          {state.release ? (
            <dl className="detail-list">
              <div>
                <dt>Status</dt>
                <dd>
                  {state.releaseCurrent
                    ? "Released (current)"
                    : state.releaseStale
                      ? "Released (stale)"
                      : state.release.status}
                </dd>
              </div>
              <div>
                <dt>Released by</dt>
                <dd>{actorName(state.release.released_by)}</dd>
              </div>
              <div>
                <dt>Released at</dt>
                <dd>{localDateTime(state.release.released_at)}</dd>
              </div>
              <div>
                <dt>Release note</dt>
                <dd>{state.release.release_note || "—"}</dd>
              </div>
              <div>
                <dt>Snapshot</dt>
                <dd>
                  Survey, system revision, RAMS revision, site record, programme,
                  area, scope and crew allocation are frozen by the database
                  against each release. Any change makes the release stale.
                </dd>
              </div>
            </dl>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No pre-start release yet.</strong>
              <p>Complete the readiness controls before releasing the job.</p>
            </div>
          )}
        </section>

        <section className="panel technical-critical">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Supervisor / owner</p>
              <h2>Release installation</h2>
            </div>
          </div>

          {!canRelease ? (
            <div className="empty-state compact-empty">
              <strong>Read-only.</strong>
              <p>Only the Owner or assigned Supervisor can release pre-start.</p>
            </div>
          ) : state.releaseCurrent ? (
            <>
              <div className="foundation-note">
                <span className="pulse" />
                <div>
                  <strong>Pre-start released</strong>
                  <p>QA may proceed while the job inputs match this release.</p>
                </div>
              </div>

              <form action={withdrawPrestart} className="compact-form prestart-action-form">
                <input type="hidden" name="project_id" value={id} />
                <label className="field">
                  <span>Reason for withdrawing</span>
                  <input
                    name="withdrawn_reason"
                    required
                    placeholder="e.g. client changed the programme; re-check before work continues"
                  />
                </label>
                <button className="secondary-button" type="submit">
                  Withdraw release
                </button>
              </form>
            </>
          ) : (
            <form action={releasePrestart} className="compact-form">
              <input type="hidden" name="project_id" value={id} />
              <label className="field">
                <span>Release note</span>
                <textarea
                  name="release_note"
                  rows={4}
                  placeholder={
                    state.releaseStale
                      ? "What changed and why the job is safe to continue."
                      : "Anything the site supervisor needs to know before work starts."
                  }
                />
              </label>
              <button
                className="primary-button full-button"
                type="submit"
                disabled={Boolean(releaseBlocked)}
              >
                {state.releaseState === "none" ? "Release pre-start" : "Issue new release"}
              </button>
              {releaseBlocked ? (
                <p className="qa-support-note">{releaseBlocked}.</p>
              ) : null}
            </form>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Audit trail</p>
            <h2>Release history</h2>
          </div>
          <span className="count-badge">{state.releases.length}</span>
        </div>

        {state.releases.length > 0 ? (
          <div className="stack-list">
            {state.releases.map((row) => (
              <div className="stack-row" key={row.id}>
                <span>
                  <strong>
                    {localDateTime(row.released_at)} · {actorName(row.released_by)}
                  </strong>
                  <small>
                    {row.release_note || "No release note"}
                    {row.status === "withdrawn"
                      ? ` · withdrawn ${localDateTime(row.withdrawn_at)} by ${actorName(row.withdrawn_by)}${row.withdrawn_reason ? `: ${row.withdrawn_reason}` : ""}`
                      : ""}
                    {row.status === "superseded"
                      ? ` · superseded ${localDateTime(row.superseded_at)}`
                      : ""}
                  </small>
                </span>
                <span className="status-badge">
                  {row.status === "released"
                    ? state.releaseCurrent
                      ? "current"
                      : "stale"
                    : row.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <strong>No releases yet.</strong>
            <p>Every release is kept here permanently, including withdrawn and superseded ones.</p>
          </div>
        )}
      </section>
    </div>
  );
}
