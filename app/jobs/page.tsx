import Link from "next/link";
import { can } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/access";
import { ProjectSearch } from "@/components/project-search";

type JobsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();
  const { supabase, role } = await requireAnyPermission([
    "jobs:view_all",
    "jobs:view_assigned",
  ]);

  const { data: projects, error } = await supabase
    .from("projects")
    .select(
      "id, reference, title, status, area_m2, programme_start, programme_end, next_action, next_action_due, clients(trading_name, legal_name), sites(name, town_city)"
    )
    .order("created_at", { ascending: false });

  const visibleProjects = (projects || []).filter((project) => {
    if (!query) return true;
    const client = Array.isArray(project.clients) ? project.clients[0] : project.clients;
    const site = Array.isArray(project.sites) ? project.sites[0] : project.sites;
    const haystack = [
      project.reference,
      project.title,
      project.status,
      client?.trading_name,
      client?.legal_name,
      site?.name,
      site?.town_city,
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query);
  });

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">One project record</p>
          <h1>Jobs</h1>
          <p>
            Every live and historic project sits here, with access automatically limited by role and assignment.
          </p>
        </div>

        {can(role, "jobs:edit") ? (
          <Link className="primary-button" href="/jobs/new">
            + New project
          </Link>
        ) : null}
      </section>

      <ProjectSearch
        action="/jobs"
        query={q}
        resultCount={visibleProjects.length}
        placeholder="Search ref, job, client, site or status"
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
            <strong>No ResinSpec projects yet.</strong>
            <p>
              Create the first project and this becomes the master job register.
            </p>
          </div>
        </section>
      ) : null}

      {visibleProjects.length > 0 ? (
        <>
          <section className="evidence-workflow-list jobs-workflow-list">
            {visibleProjects.map((project) => {
              const client = Array.isArray(project.clients)
                ? project.clients[0]
                : project.clients;
              const site = Array.isArray(project.sites)
                ? project.sites[0]
                : project.sites;

              return (
                <article className="evidence-workflow-card" key={project.id}>
                  <div className="evidence-workflow-card-head">
                    <div>
                      <span>{project.reference}</span>
                      <strong>{project.title}</strong>
                      <small>
                        {client?.trading_name ||
                          client?.legal_name ||
                          site?.name ||
                          "Client not added"}
                        {site?.town_city ? ` · ${site.town_city}` : ""}
                      </small>
                    </div>
                    <span className="status-badge">{project.status}</span>
                  </div>

                  <div className="evidence-workflow-stats jobs-workflow-stats">
                    <span>
                      <small>Area</small>
                      <strong>{project.area_m2 ? `${project.area_m2} m²` : "TBC"}</strong>
                    </span>
                    <span>
                      <small>Programme</small>
                      <strong>
                        {project.programme_start || project.programme_end
                          ? `${project.programme_start ?? "TBC"} → ${project.programme_end ?? "TBC"}`
                          : "TBC"}
                      </strong>
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
            })}
          </section>

          <section className="table-card evidence-desktop-table">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Area</th>
                  <th>Programme</th>
                  <th>Next action</th>
                </tr>
              </thead>
              <tbody>
                {visibleProjects.map((project) => {
                  const client = Array.isArray(project.clients)
                    ? project.clients[0]
                    : project.clients;
                  const site = Array.isArray(project.sites)
                    ? project.sites[0]
                    : project.sites;

                  return (
                    <tr key={project.id}>
                      <td>
                        <Link className="table-link" href={`/jobs/${project.id}`}>
                          {project.reference}
                        </Link>
                      </td>
                      <td>
                        <strong>{project.title}</strong>
                        <small>
                          {client?.trading_name ||
                            client?.legal_name ||
                            site?.name ||
                            "Client not added"}
                          {site?.town_city ? ` · ${site.town_city}` : ""}
                        </small>
                      </td>
                      <td>
                        <span className="status-badge">{project.status}</span>
                      </td>
                      <td>{project.area_m2 ? `${project.area_m2} m²` : "—"}</td>
                      <td>
                        {project.programme_start || project.programme_end
                          ? `${project.programme_start ?? "TBC"} → ${project.programme_end ?? "TBC"}`
                          : "TBC"}
                      </td>
                      <td>
                        {project.next_action || "—"}
                        {project.next_action_due ? (
                          <small>{project.next_action_due}</small>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </section>
        </>
      ) : query && projects && projects.length > 0 ? (
        <section className="panel">
          <div className="empty-state compact-empty">
            <strong>No matching jobs.</strong>
            <p>Try a reference, client, site or part of the job title.</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
