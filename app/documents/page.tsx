import Link from "next/link";
import { requireAnyPermission } from "@/lib/access";

type RamsRow = {
  project_id: string;
  status: string;
  version: number;
  approved_at: string | null;
};

export default async function DocumentsOverviewPage() {
  const { supabase } = await requireAnyPermission(["documents:view"]);

  const [
    { data: projects, error },
    { data: ramsRows },
    { data: documents },
    { data: qaRows },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, reference, title, status, programme_start, programme_end")
      .not("status", "in", "(lost,closed)")
      .order("programme_start", { ascending: true, nullsFirst: false }),
    supabase
      .from("rams_documents")
      .select("project_id, status, version, approved_at")
      .order("version", { ascending: false }),
    supabase
      .from("documents")
      .select("project_id, status, document_type, acknowledgement_required")
      .is("qa_record_id", null)
      .is("survey_id", null),
    supabase
      .from("qa_records")
      .select("project_id, status, hold_point"),
  ]);

  const latestRams = new Map<string, RamsRow>();
  for (const row of (ramsRows || []) as RamsRow[]) {
    if (!latestRams.has(row.project_id)) {
      latestRams.set(row.project_id, row);
    }
  }

  const docsByProject = new Map<string, number>();
  for (const document of documents || []) {
    docsByProject.set(
      document.project_id,
      (docsByProject.get(document.project_id) || 0) + 1
    );
  }

  const qaOpenByProject = new Map<string, number>();
  for (const qa of qaRows || []) {
    if (["open", "complete", "rejected"].includes(qa.status)) {
      qaOpenByProject.set(
        qa.project_id,
        (qaOpenByProject.get(qa.project_id) || 0) + 1
      );
    }
  }

  const approvedRamsCount = (projects || []).filter(
    (project) => latestRams.get(project.id)?.status === "approved"
  ).length;
  const openQaCount = Array.from(qaOpenByProject.values()).reduce(
    (sum, count) => sum + count,
    0
  );
  const projectDocsCount = documents?.length || 0;

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Controlled project evidence</p>
          <h1>Documents & QA</h1>
          <p>
            Select the job, then follow the Site Workflow. The job screen tells the site team exactly what needs doing next.
          </p>
        </div>
      </section>

      {error ? <p className="form-error page-error">{error.message}</p> : null}

      <section className="metric-grid">
        <article className="metric-card">
          <span>Active projects</span>
          <strong>{projects?.length || 0}</strong>
          <small>Visible to your role</small>
        </article>
        <article className="metric-card">
          <span>Approved RAMS</span>
          <strong>{approvedRamsCount}</strong>
          <small>Current latest revisions</small>
        </article>
        <article className="metric-card">
          <span>Project documents</span>
          <strong>{projectDocsCount}</strong>
          <small>Controlled files</small>
        </article>
        <article className="metric-card">
          <span>QA requiring action</span>
          <strong>{openQaCount}</strong>
          <small>Open / complete / rejected</small>
        </article>
      </section>

      <section className="evidence-workflow-list">
        {projects && projects.length > 0 ? (
          projects.map((project) => {
            const rams = latestRams.get(project.id);
            const qaOpen = qaOpenByProject.get(project.id) || 0;
            const docCount = docsByProject.get(project.id) || 0;

            return (
              <article className="evidence-workflow-card" key={project.id}>
                <div className="evidence-workflow-card-head">
                  <div>
                    <span>{project.reference}</span>
                    <strong>{project.title}</strong>
                  </div>
                  <span className="status-badge">{project.status}</span>
                </div>

                <div className="evidence-workflow-stats">
                  <span>
                    <small>RAMS</small>
                    <strong>{rams ? `${rams.status} · Rev ${rams.version}` : "Missing"}</strong>
                  </span>
                  <span>
                    <small>Files</small>
                    <strong>{docCount}</strong>
                  </span>
                  <span>
                    <small>QA action</small>
                    <strong>{qaOpen > 0 ? qaOpen : "Clear"}</strong>
                  </span>
                </div>

                <Link
                  className="primary-button evidence-workflow-open"
                  href={`/jobs/${project.id}`}
                >
                  Open job workflow →
                </Link>
              </article>
            );
          })
        ) : null}
      </section>

      <section className="table-card evidence-desktop-table">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Stage</th>
                <th>RAMS</th>
                <th>Files</th>
                <th>QA action</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {projects && projects.length > 0 ? (
                projects.map((project) => {
                  const rams = latestRams.get(project.id);
                  const qaOpen = qaOpenByProject.get(project.id) || 0;
                  const docCount = docsByProject.get(project.id) || 0;

                  return (
                    <tr key={project.id}>
                      <td>
                        <Link
                          className="table-link"
                          href={`/jobs/${project.id}`}
                        >
                          {project.reference} · {project.title}
                        </Link>
                        <small>
                          {project.programme_start || "Start TBC"}
                          {project.programme_end
                            ? ` → ${project.programme_end}`
                            : ""}
                        </small>
                      </td>
                      <td>
                        <span className="status-badge">{project.status}</span>
                      </td>
                      <td>
                        {rams ? (
                          <>
                            <span
                              className={
                                rams.status === "approved"
                                  ? "status-badge"
                                  : "status-badge qa-complete"
                              }
                            >
                              {rams.status}
                            </span>
                            <small>Rev {rams.version}</small>
                          </>
                        ) : (
                          <span className="missing-control">Missing</span>
                        )}
                      </td>
                      <td>{docCount}</td>
                      <td>
                        {qaOpen > 0 ? (
                          <span className="missing-control">{qaOpen}</span>
                        ) : (
                          <span className="status-badge">Clear</span>
                        )}
                      </td>
                      <td>
                        <Link
                          className="primary-button workflow-open-button"
                          href={`/jobs/${project.id}`}
                        >
                          Open workflow
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state compact-empty">
                      <strong>No active projects.</strong>
                      <p>Project compliance status will appear here.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
