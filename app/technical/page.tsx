import Link from "next/link";
import { can } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/access";

export default async function TechnicalPage() {
  const { supabase, role } = await requireAnyPermission(["technical:view"]);

  const { data: systems, error } = await supabase
    .from("technical_systems")
    .select(
      "id, code, name, manufacturer, revision, status, category, nominal_thickness_mm, slip_rating, approved_at"
    )
    .order("code")
    .order("revision", { ascending: false });

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Controlled system library</p>
          <h1>Technical</h1>
          <p>
            Approved resin systems, application limits and mixing information. Jobs link to an exact revision so the original specification is preserved.
          </p>
        </div>

        {can(role, "technical:edit") ? (
          <Link className="primary-button" href="/technical/new">
            + New system
          </Link>
        ) : null}
      </section>

      {error ? (
        <section className="panel">
          <strong>Could not load technical systems.</strong>
          <p className="muted-copy">{error.message}</p>
        </section>
      ) : null}

      {!error && (!systems || systems.length === 0) ? (
        <section className="panel">
          <div className="empty-state">
            <strong>No systems approved yet.</strong>
            <p>
              Add manufacturer-backed systems here after training and technical sign-off.
            </p>
          </div>
        </section>
      ) : null}

      {systems && systems.length > 0 ? (
        <section className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>System</th>
                  <th>Manufacturer</th>
                  <th>Revision</th>
                  <th>Category</th>
                  <th>Thickness</th>
                  <th>Slip</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {systems.map((system) => (
                  <tr key={system.id}>
                    <td>
                      <Link className="table-link" href={`/technical/${system.id}`}>
                        {system.code}
                      </Link>
                      <small>{system.name}</small>
                    </td>
                    <td>{system.manufacturer || "—"}</td>
                    <td>Rev {system.revision}</td>
                    <td>{system.category || "—"}</td>
                    <td>
                      {system.nominal_thickness_mm
                        ? `${system.nominal_thickness_mm} mm`
                        : "—"}
                    </td>
                    <td>{system.slip_rating || "—"}</td>
                    <td>
                      <span className="status-badge">{system.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
