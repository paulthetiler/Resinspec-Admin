import Link from "next/link";
import { requireAnyPermission } from "@/lib/access";
import { ProjectSearch } from "@/components/project-search";

type EstimatorPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function EstimatorPage({
  searchParams,
}: EstimatorPageProps) {
  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();
  const { supabase } = await requireAnyPermission(["commercial:view"]);

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, reference, title, status, area_m2, updated_at")
    .not("status", "in", "(lost,closed)")
    .order("updated_at", { ascending: false });

  const visibleProjects = (projects || []).filter((project) => {
    if (!query) return true;
    const haystack = [
      project.reference,
      project.title,
      project.status,
      project.area_m2,
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Pricing</p>
          <h1>Estimator</h1>
          <p>
            Open a project estimate, build the cost plan and keep every pricing revision against the job record.
          </p>
        </div>
      </section>

      <ProjectSearch
        action="/estimator"
        query={q}
        resultCount={visibleProjects.length}
        placeholder="Search reference, job or status"
      />

      {error ? (
        <section className="panel">
          <strong>Could not load projects.</strong>
          <p className="muted-copy">{error.message}</p>
        </section>
      ) : null}

      {!error && (!projects || projects.length === 0) ? (
        <section className="panel">
          <div className="empty-state">
            <strong>No projects to estimate yet.</strong>
            <p>Create a project first, then its estimate will appear here.</p>
          </div>
        </section>
      ) : null}

      {visibleProjects.length > 0 ? (
        <section className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Area</th>
                  <th>Estimate</th>
                </tr>
              </thead>
              <tbody>
                {visibleProjects.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <strong>{project.reference}</strong>
                      <small>{project.title}</small>
                    </td>
                    <td>
                      <span className="status-badge">{project.status}</span>
                    </td>
                    <td>{project.area_m2 ? `${project.area_m2} m²` : "—"}</td>
                    <td>
                      <Link
                        className="primary-button"
                        href={`/jobs/${project.id}/estimate`}
                      >
                        Open estimate
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : query && projects && projects.length > 0 ? (
        <section className="panel">
          <div className="empty-state compact-empty">
            <strong>No matching estimate jobs.</strong>
            <p>Try the project reference, title or current status.</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
