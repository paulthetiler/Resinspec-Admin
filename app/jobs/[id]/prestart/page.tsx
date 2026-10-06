import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { getPrestartState, type PrestartCheckCode } from "@/lib/prestart";
import { releasePrestart, reopenPrestart } from "./actions";

type PrestartPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    released?: string;
    reopened?: string;
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
  const { error, released, reopened } = await searchParams;
  const { supabase, role } = await requireAnyPermission([
    "jobs:view_all",
    "jobs:view_assigned",
  ]);

  const state = await getPrestartState(supabase, id);
  if (!state) notFound();

  const canRelease = role === "owner" || role === "supervisor";

  let releasedBy = "—";
  if (state.release?.released_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", state.release.released_by)
      .maybeSingle();
    releasedBy = profile?.full_name || "Team member";
  }

  const releasedCount = state.checks.filter((check) => check.pass).length;
  const controlStatus = state.releaseCurrent
    ? "released"
    : state.releaseStale
      ? "stale"
      : "blocked";

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
      {reopened ? (
        <p className="form-success page-error">
          Pre-start release reopened for review.
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
          <strong className={`status-badge prestart-${controlStatus}`}>
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

      {state.releaseStale ? (
        <p className="prestart-stale-note">
          The job was released previously, but a controlled input has changed
          since then. Re-check the items below and re-release before starting
          installation.
        </p>
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
                <dd>{state.release.status}</dd>
              </div>
              <div>
                <dt>Released by</dt>
                <dd>{releasedBy}</dd>
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
                  area, scope and crew count are frozen against this release.
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
                  <p>Gate 1 is permitted to proceed when the site is ready.</p>
                </div>
              </div>

              <form action={reopenPrestart} className="compact-form prestart-action-form">
                <input type="hidden" name="project_id" value={id} />
                <label className="field">
                  <span>Reason for reopening</span>
                  <input
                    name="release_note"
                    placeholder="e.g. programme or system needs re-checking"
                  />
                </label>
                <button className="secondary-button" type="submit">
                  Reopen pre-start
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
                  placeholder="Anything the site supervisor needs to know before work starts."
                />
              </label>
              <button
                className="primary-button full-button"
                type="submit"
                disabled={!state.allPass}
              >
                {state.releaseStale ? "Re-release pre-start" : "Release pre-start"}
              </button>
              {!state.allPass ? (
                <p className="qa-support-note">
                  Release is locked until every readiness check above passes.
                </p>
              ) : null}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
