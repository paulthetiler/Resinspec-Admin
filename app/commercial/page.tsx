import Link from "next/link";
import { requireAnyPermission } from "@/lib/access";

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export default async function CommercialPage() {
  const { supabase } = await requireAnyPermission(["commercial:view"]);

  const { data: projects, error } = await supabase
    .from("projects")
    .select(
      "id, reference, title, status, project_commercials(order_value, estimated_direct_cost, contingency_pct, risk_adjusted_cost, target_margin_pct, actual_direct_cost, variation_value, invoiced_value, paid_value, retention_value, due_date)"
    )
    .not("status", "in", "(lost,closed)")
    .order("updated_at", { ascending: false });

  const rows = (projects || []).map((project) => {
    const commercial = Array.isArray(project.project_commercials)
      ? project.project_commercials[0]
      : project.project_commercials;

    const order = Number(commercial?.order_value ?? 0);
    const variations = Number(commercial?.variation_value ?? 0);
    const revenue = order + variations;
    const riskCost = Number(commercial?.risk_adjusted_cost ?? 0);
    const forecastContribution = revenue - riskCost;
    const forecastMargin =
      revenue > 0 ? (forecastContribution / revenue) * 100 : null;

    return {
      project,
      commercial,
      revenue,
      riskCost,
      forecastContribution,
      forecastMargin,
      outstanding:
        Number(commercial?.invoiced_value ?? 0) -
        Number(commercial?.paid_value ?? 0),
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.revenue += row.revenue;
      acc.riskCost += row.riskCost;
      acc.outstanding += row.outstanding;
      acc.paid += Number(row.commercial?.paid_value ?? 0);
      return acc;
    },
    { revenue: 0, riskCost: 0, outstanding: 0, paid: 0 }
  );

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Restricted commercial</p>
          <h1>Commercial</h1>
          <p>
            Cost, margin and cash exposure. This area is unavailable to normal Office, Supervisor and Installer roles.
          </p>
        </div>
      </section>

      {error ? <p className="form-error page-error">{error.message}</p> : null}

      <section className="metric-grid">
        <article className="metric-card">
          <span>Order + variations</span>
          <strong>{money(totals.revenue)}</strong>
          <small>Across open projects</small>
        </article>
        <article className="metric-card">
          <span>Risk-adjusted cost</span>
          <strong>{money(totals.riskCost)}</strong>
          <small>Includes job contingency</small>
        </article>
        <article className="metric-card">
          <span>Invoiced outstanding</span>
          <strong>{money(totals.outstanding)}</strong>
          <small>Invoiced less paid</small>
        </article>
        <article className="metric-card">
          <span>Cash received</span>
          <strong>{money(totals.paid)}</strong>
          <small>Recorded payments</small>
        </article>
      </section>

      <section className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Revenue</th>
                <th>Risk cost</th>
                <th>Forecast contribution</th>
                <th>Forecast margin</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.project.id}>
                    <td>
                      <Link
                        className="table-link"
                        href={`/jobs/${row.project.id}/commercial`}
                      >
                        {row.project.reference} · {row.project.title}
                      </Link>
                      <small>
                        {row.commercial
                          ? "Commercial record active"
                          : "Commercial record not set up"}
                      </small>
                    </td>
                    <td>
                      <span className="status-badge">{row.project.status}</span>
                    </td>
                    <td>{row.commercial ? money(row.revenue) : "—"}</td>
                    <td>{row.commercial ? money(row.riskCost) : "—"}</td>
                    <td>
                      {row.commercial ? money(row.forecastContribution) : "—"}
                    </td>
                    <td>
                      {row.forecastMargin === null
                        ? "—"
                        : `${row.forecastMargin.toFixed(1)}%`}
                    </td>
                    <td>{row.commercial ? money(row.outstanding) : "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state compact-empty">
                      <strong>No commercial jobs yet.</strong>
                      <p>Won jobs will flow into this view.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="foundation-note commercial-placeholder">
        <span className="pulse" />
        <div>
          <strong>Estimator slot reserved</strong>
          <p>
            The estimator will feed the same project commercial record later; it will not become a separate disconnected calculator.
          </p>
        </div>
      </section>
    </div>
  );
}
