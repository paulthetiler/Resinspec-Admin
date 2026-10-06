import Link from "next/link";
import { can } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/access";
import { updatePipelineStage } from "./actions";
import { ProjectSearch } from "@/components/project-search";

type PipelinePageProps = {
  searchParams: Promise<{ error?: string; q?: string }>;
};

const stageLabels: Record<string, string> = {
  lead: "Lead",
  qualifying: "Qualifying",
  survey: "Survey",
  estimating: "Estimating",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

function dueText(value: string | null) {
  if (!value) return "—";
  return new Date(value + "T00:00:00Z").toLocaleDateString("en-GB");
}

export default async function PipelinePage({
  searchParams,
}: PipelinePageProps) {
  const { error, q = "" } = await searchParams;
  const query = q.trim().toLowerCase();
  const { supabase, role } = await requireAnyPermission(["pipeline:view"]);

  const { data: projects, error: loadError } = await supabase
    .from("projects")
    .select(
      "id, reference, title, status, area_m2, next_action, next_action_due, updated_at, clients(trading_name, legal_name), sites(name, town_city)"
    )
    .in("status", [
      "lead",
      "qualifying",
      "survey",
      "estimating",
      "quoted",
      "won",
      "lost",
    ])
    .order("updated_at", { ascending: false });

  const visibleProjects = (projects || []).filter((project) => {
    if (!query) return true;
    const client = Array.isArray(project.clients) ? project.clients[0] : project.clients;
    const site = Array.isArray(project.sites) ? project.sites[0] : project.sites;
    const haystack = [
      project.reference,
      project.title,
      project.status,
      project.next_action,
      client?.trading_name,
      client?.legal_name,
      site?.name,
      site?.town_city,
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query);
  });

  const open = visibleProjects.filter(
    (project) => !["won", "lost"].includes(project.status)
  );
  const decided = visibleProjects.filter((project) =>
    ["won", "lost"].includes(project.status)
  );

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Enquiry to order</p>
          <h1>Pipeline</h1>
          <p>
            Every opportunity stays attached to the same project record if it becomes a live job.
          </p>
        </div>
        {can(role, "pipeline:edit") ? (
          <Link className="primary-button" href="/jobs/new">
            + New enquiry
          </Link>
        ) : null}
      </section>

      <ProjectSearch
        action="/pipeline"
        query={q}
        resultCount={visibleProjects.length}
        placeholder="Search ref, enquiry, client, site or next action"
      />

      {error || loadError ? (
        <p className="form-error page-error">
          {error || loadError?.message}
        </p>
      ) : null}

      <section className="metric-grid pipeline-metrics">
        {["lead", "survey", "estimating", "quoted"].map((stage) => (
          <article className="metric-card" key={stage}>
            <span>{stageLabels[stage]}</span>
            <strong>
              {(projects || []).filter((project) => project.status === stage).length}
            </strong>
            <small>Current opportunities</small>
          </article>
        ))}
      </section>

      <section className="table-card">
        <div className="table-scroll">
          <table className="data-table pipeline-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Stage</th>
                <th>Area</th>
                <th>Next action</th>
                <th>Due</th>
                {can(role, "pipeline:edit") ? <th>Move</th> : null}
              </tr>
            </thead>
            <tbody>
              {open.length > 0 ? (
                open.map((project) => {
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
                          {project.reference} · {project.title}
                        </Link>
                        <small>
                          {client?.trading_name ||
                            client?.legal_name ||
                            site?.name ||
                            "Client not added"}
                          {site?.town_city ? ` · ${site.town_city}` : ""}
                        </small>
                      </td>
                      <td>
                        <span className="status-badge">
                          {stageLabels[project.status] || project.status}
                        </span>
                      </td>
                      <td>{project.area_m2 ? `${project.area_m2} m²` : "—"}</td>
                      <td>{project.next_action || "—"}</td>
                      <td>{dueText(project.next_action_due)}</td>
                      {can(role, "pipeline:edit") ? (
                        <td>
                          <form action={updatePipelineStage} className="stage-form">
                            <input type="hidden" name="project_id" value={project.id} />
                            <select name="status" defaultValue={project.status}>
                              {Object.entries(stageLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <button className="text-button" type="submit">
                              Save
                            </button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={can(role, "pipeline:edit") ? 6 : 5}>
                    <div className="empty-state compact-empty">
                      <strong>No open opportunities.</strong>
                      <p>New enquiries will appear here automatically.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {decided.length > 0 ? (
        <details className="completed-actions pipeline-history">
          <summary>Won / lost ({decided.length})</summary>
          <div className="stack-list">
            {decided.slice(0, 20).map((project) => (
              <Link
                className="stack-row"
                href={`/jobs/${project.id}`}
                key={project.id}
              >
                <span>
                  <strong>{project.reference} · {project.title}</strong>
                  <small>{stageLabels[project.status]}</small>
                </span>
              </Link>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
