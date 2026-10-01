import Link from "next/link";
import { can } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/access";

function expiryText(value: string | null) {
  if (!value) return "—";
  return new Date(value + "T00:00:00Z").toLocaleDateString("en-GB");
}

export default async function PeoplePage() {
  const { supabase, role } = await requireAnyPermission(["people:view"]);

  const includeCommercial = can(role, "financials:view");

  const peopleQuery = supabase
    .from("people")
    .select(
      "id, full_name, email, phone, engagement_type, primary_role, active, cscs_expiry, insurance_expiry, user_id"
    )
    .order("active", { ascending: false })
    .order("full_name");

  const [{ data: people, error }, commercialResult] = await Promise.all([
    peopleQuery,
    includeCommercial
      ? supabase.from("people_commercials").select("person_id, day_rate, hourly_rate")
      : Promise.resolve({ data: null, error: null }),
  ]);

  const commercialByPerson = new Map(
    (commercialResult.data || []).map((row) => [row.person_id, row])
  );

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Competence & allocation</p>
          <h1>People</h1>
          <p>
            Employees and subcontractors can exist here before they have a login. When an account is later linked, their assigned jobs become visible automatically.
          </p>
        </div>

        {can(role, "people:manage") ? (
          <Link className="primary-button" href="/people/new">
            + Add person
          </Link>
        ) : null}
      </section>

      {error ? (
        <section className="panel">
          <strong>Could not load people.</strong>
          <p className="muted-copy">{error.message}</p>
        </section>
      ) : null}

      {!error && (!people || people.length === 0) ? (
        <section className="panel">
          <div className="empty-state">
            <strong>No workforce records yet.</strong>
            <p>Add subcontractors, installers and supervisors as you build the team.</p>
          </div>
        </section>
      ) : null}

      {people && people.length > 0 ? (
        <section className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Type</th>
                  <th>Login</th>
                  <th>CSCS expiry</th>
                  <th>Insurance expiry</th>
                  {includeCommercial ? <th>Rate</th> : null}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => {
                  const commercial = commercialByPerson.get(person.id);

                  return (
                    <tr key={person.id}>
                      <td>
                        <Link className="table-link" href={`/people/${person.id}`}>
                          {person.full_name}
                        </Link>
                        <small>{person.email || person.phone || "No contact added"}</small>
                      </td>
                      <td>{person.primary_role || "—"}</td>
                      <td>{person.engagement_type}</td>
                      <td>{person.user_id ? "Linked" : "Not linked"}</td>
                      <td>{expiryText(person.cscs_expiry)}</td>
                      <td>{expiryText(person.insurance_expiry)}</td>
                      {includeCommercial ? (
                        <td>
                          {commercial?.day_rate
                            ? `£${commercial.day_rate}/day`
                            : commercial?.hourly_rate
                            ? `£${commercial.hourly_rate}/hr`
                            : "—"}
                        </td>
                      ) : null}
                      <td>
                        <span className="status-badge">
                          {person.active ? "active" : "inactive"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
