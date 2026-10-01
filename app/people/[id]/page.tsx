import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { can } from "@/lib/permissions";

type PersonPageProps = {
  params: Promise<{ id: string }>;
};

function dateText(value: string | null) {
  return value
    ? new Date(value + "T00:00:00Z").toLocaleDateString("en-GB")
    : "—";
}

export default async function PersonPage({ params }: PersonPageProps) {
  const { id } = await params;
  const { supabase, role } = await requireAnyPermission(["people:view"]);

  const { data: person } = await supabase
    .from("people")
    .select("*")
    .eq("id", id)
    .single();

  if (!person) notFound();

  const commercial = can(role, "financials:view")
    ? (
        await supabase
          .from("people_commercials")
          .select("*")
          .eq("person_id", id)
          .maybeSingle()
      ).data
    : null;

  const { data: assignments } = await supabase
    .from("project_assignments")
    .select("id, assignment_role, starts_on, ends_on, projects(id, reference, title, status)")
    .eq("person_id", id)
    .order("starts_on", { ascending: false });

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{person.engagement_type}</p>
          <h1>{person.full_name}</h1>
          <p>
            {person.primary_role || "Role not set"}
            {person.email ? ` · ${person.email}` : ""}
          </p>
        </div>
        <Link className="secondary-button" href="/people">
          Back to people
        </Link>
      </section>

      <section className="detail-grid">
        <article className="detail-card">
          <span>Status</span>
          <strong className="status-badge">{person.active ? "active" : "inactive"}</strong>
        </article>
        <article className="detail-card">
          <span>Login</span>
          <strong>{person.user_id ? "Linked" : "Not linked"}</strong>
        </article>
        <article className="detail-card">
          <span>CSCS expiry</span>
          <strong>{dateText(person.cscs_expiry)}</strong>
        </article>
        <article className="detail-card">
          <span>Insurance expiry</span>
          <strong>{dateText(person.insurance_expiry)}</strong>
        </article>
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Operational</p>
              <h2>Competence & notes</h2>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Training / competence</dt>
              <dd>{person.training_notes || "Not recorded"}</dd>
            </div>
            <div>
              <dt>Operational notes</dt>
              <dd>{person.operational_notes || "None"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{person.phone || "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Current allocation</p>
              <h2>Jobs</h2>
            </div>
          </div>

          {assignments && assignments.length > 0 ? (
            <div className="stack-list">
              {assignments.map((assignment) => {
                const project = Array.isArray(assignment.projects)
                  ? assignment.projects[0]
                  : assignment.projects;

                return (
                  <Link
                    key={assignment.id}
                    className="stack-row"
                    href={project ? `/jobs/${project.id}` : "/jobs"}
                  >
                    <span>
                      <strong>{project?.reference || "Project"}</strong>
                      <small>{project?.title || "Unknown project"}</small>
                    </span>
                    <span className="status-badge">{assignment.assignment_role}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No current assignments.</strong>
              <p>Add this person to a job from that project’s Crew screen.</p>
            </div>
          )}
        </section>
      </div>

      {can(role, "financials:view") ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Restricted commercial</p>
              <h2>Pay basis</h2>
            </div>
          </div>
          <div className="commercial-grid">
            <div>
              <span>Day rate</span>
              <strong>{commercial?.day_rate ? `£${commercial.day_rate}` : "—"}</strong>
            </div>
            <div>
              <span>Hourly rate</span>
              <strong>{commercial?.hourly_rate ? `£${commercial.hourly_rate}` : "—"}</strong>
            </div>
            <div>
              <span>Working away</span>
              <strong>
                {commercial?.working_away_allowance
                  ? `£${commercial.working_away_allowance}`
                  : "—"}
              </strong>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
