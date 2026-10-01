import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { assignCrewMember, removeCrewMember } from "./actions";

type CrewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function CrewPage({
  params,
  searchParams,
}: CrewPageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase } = await requireAnyPermission(["jobs:edit"]);

  const [{ data: project }, { data: people }, { data: assignments }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, reference, title, programme_start, programme_end")
        .eq("id", id)
        .single(),
      supabase
        .from("people")
        .select("id, full_name, primary_role, engagement_type, active, user_id")
        .eq("active", true)
        .order("full_name"),
      supabase
        .from("project_assignments")
        .select(
          "id, assignment_role, starts_on, ends_on, person_id, people(id, full_name, primary_role, engagement_type, user_id)"
        )
        .eq("project_id", id)
        .order("starts_on"),
    ]);

  if (!project) notFound();

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · crew</p>
          <h1>{project.title}</h1>
          <p>
            Allocate the site team here. If a person has a linked login, this assignment also controls their job access.
          </p>
        </div>
        <Link className="secondary-button" href={`/jobs/${id}`}>
          Back to job
        </Link>
      </section>

      {error ? <p className="form-error page-error">{error}</p> : null}

      <div className="two-column">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Current crew</p>
              <h2>Allocated people</h2>
            </div>
            <span className="count-badge">{assignments?.length || 0}</span>
          </div>

          {assignments && assignments.length > 0 ? (
            <div className="stack-list">
              {assignments.map((assignment) => {
                const person = Array.isArray(assignment.people)
                  ? assignment.people[0]
                  : assignment.people;

                return (
                  <div className="stack-row stack-row-action" key={assignment.id}>
                    <span>
                      <strong>{person?.full_name || "Unknown person"}</strong>
                      <small>
                        {assignment.assignment_role}
                        {person?.user_id ? " · app access linked" : " · no login"}
                      </small>
                    </span>

                    <form action={removeCrewMember}>
                      <input type="hidden" name="project_id" value={id} />
                      <input
                        type="hidden"
                        name="assignment_id"
                        value={assignment.id}
                      />
                      <button className="text-button danger-text" type="submit">
                        Remove
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No crew allocated.</strong>
              <p>Add the team before mobilisation so job access and paperwork are controlled from the project.</p>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Allocation</p>
              <h2>Add / update crew</h2>
            </div>
          </div>

          <form action={assignCrewMember} className="compact-form">
            <input type="hidden" name="project_id" value={id} />

            <label className="field">
              <span>Person</span>
              <select name="person_id" required defaultValue="">
                <option value="" disabled>Select person</option>
                {(people || []).map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                    {person.primary_role ? ` · ${person.primary_role}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Assignment role</span>
              <select name="assignment_role" defaultValue="installer">
                <option value="supervisor">Supervisor</option>
                <option value="crew_leader">Crew leader</option>
                <option value="installer">Installer</option>
                <option value="trainee">Trainee</option>
                <option value="office_support">Office support</option>
              </select>
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Starts</span>
                <input
                  name="starts_on"
                  type="date"
                  defaultValue={project.programme_start || ""}
                />
              </label>

              <label className="field">
                <span>Ends</span>
                <input
                  name="ends_on"
                  type="date"
                  defaultValue={project.programme_end || ""}
                />
              </label>
            </div>

            <button className="primary-button full-button" type="submit">
              Save allocation
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
