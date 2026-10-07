import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { can } from "@/lib/permissions";
import { PersonAccessControl } from "@/components/person-access-control";

type PersonPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; commercial_error?: string }>;
};

function dateText(value: string | null) {
  return value
    ? new Date(value + "T00:00:00Z").toLocaleDateString("en-GB")
    : "—";
}

export default async function PersonPage({
  params,
  searchParams,
}: PersonPageProps) {
  const { id } = await params;
  const { updated, commercial_error } = await searchParams;
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

  const currentAccessRole =
    role === "owner" && person.user_id
      ? (
          await supabase.rpc("get_user_role", {
            target_user_id: person.user_id,
          })
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
        <div className="heading-actions">
          {can(role, "people:manage") ? (
            <Link
              className="primary-button person-edit-button"
              href={`/people/${id}/edit`}
            >
              Edit person
            </Link>
          ) : null}
          <Link className="secondary-button" href="/people">
            Back to people
          </Link>
        </div>
      </section>

      {updated ? (
        <p className="form-success page-error">Person record updated.</p>
      ) : null}
      {commercial_error ? (
        <p className="form-error page-error">
          Person was created, but the commercial details could not be saved: {commercial_error}
        </p>
      ) : null}

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


      {person.engagement_type === "subcontractor" ? (
        <section className="panel">
          <div className="panel-head"><div><p className="eyebrow">CIS & status</p><h2>Subcontractor compliance</h2></div></div>
          <div className="commercial-grid">
            <div><span>Trading name</span><strong>{person.trading_name || "—"}</strong></div>
            <div><span>UTR</span><strong>{person.utr || "—"}</strong></div>
            <div><span>CIS verification</span><strong>{person.cis_verification_number || "Not verified"}</strong></div>
            <div><span>CIS rate</span><strong>{person.cis_deduction_rate === null ? "—" : `${person.cis_deduction_rate}%`}</strong></div>
            <div><span>Verified on</span><strong>{dateText(person.cis_verified_on)}</strong></div>
            <div><span>Status outcome</span><strong>{person.status_outcome ? String(person.status_outcome).replaceAll("_", " ") : "Not checked"}</strong></div>
            <div><span>Status checked</span><strong>{dateText(person.status_checked_on)}</strong></div>
            <div><span>Agreement signed</span><strong>{dateText(person.contract_signed_on)}</strong></div>
            <div className="commercial-grid-wide"><span>Contractor / status notes</span><strong>{person.contractor_notes || "—"}</strong></div>
          </div>
          {(!person.cis_verified_on || !person.status_checked_on || !person.contract_signed_on) ? (
            <p className="form-error page-error">Onboarding incomplete: verify CIS, record the employment-status check and sign the subcontract agreement before first payment.</p>
          ) : null}
        </section>
      ) : null}

      {role === "owner" ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Owner only</p>
              <h2>App access</h2>
            </div>
          </div>
          <PersonAccessControl
            personId={person.id}
            email={person.email}
            userId={person.user_id}
            currentRole={currentAccessRole}
          />
        </section>
      ) : null}

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
              <span>Mileage</span>
              <strong>
                {commercial?.mileage_rate
                  ? `£${commercial.mileage_rate}/mile`
                  : "—"}
              </strong>
            </div>
            <div>
              <span>Working away</span>
              <strong>
                {commercial?.working_away_allowance
                  ? `£${commercial.working_away_allowance}`
                  : "—"}
              </strong>
            </div>
            <div className="commercial-grid-wide">
              <span>Commercial / pay notes</span>
              <strong>{commercial?.commercial_notes || "—"}</strong>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
