import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { saveCommercial } from "./actions";

type ProjectCommercialProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function ProjectCommercialPage({
  params,
  searchParams,
}: ProjectCommercialProps) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const { supabase } = await requireAnyPermission(["commercial:view"]);

  const [{ data: project }, { data: commercial }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, reference, title, status")
      .eq("id", id)
      .single(),
    supabase
      .from("project_commercials")
      .select("*")
      .eq("project_id", id)
      .maybeSingle(),
  ]);

  if (!project) notFound();

  const order = Number(commercial?.order_value ?? 0);
  const variations = Number(commercial?.variation_value ?? 0);
  const revenue = order + variations;
  const riskCost = Number(commercial?.risk_adjusted_cost ?? 0);
  const forecastContribution = revenue - riskCost;
  const forecastMargin =
    revenue > 0 ? (forecastContribution / revenue) * 100 : null;
  const actualCost = Number(commercial?.actual_direct_cost ?? 0);
  const actualContribution = revenue - actualCost;
  const actualMargin =
    revenue > 0 && actualCost > 0
      ? (actualContribution / revenue) * 100
      : null;

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · restricted commercial</p>
          <h1>{project.title}</h1>
          <p>Estimate, contingency, margin, applications and cash position for this job.</p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" href={`/jobs/${id}/variations`}>
            Variations
          </Link>
          <Link className="secondary-button" href={`/jobs/${id}/invoices`}>
            Invoices
          </Link>
          <Link className="secondary-button" href={`/jobs/${id}`}>
            Back to job
          </Link>
        </div>
      </section>

      {error ? <p className="form-error page-error">{error}</p> : null}
      {saved ? <p className="form-success page-error">Commercial record saved.</p> : null}

      <section className="detail-grid">
        <article className="detail-card">
          <span>Revenue</span>
          <strong>{money(revenue)}</strong>
        </article>
        <article className="detail-card">
          <span>Risk-adjusted cost</span>
          <strong>{commercial ? money(riskCost) : "—"}</strong>
        </article>
        <article className="detail-card">
          <span>Forecast margin</span>
          <strong>
            {forecastMargin === null ? "—" : `${forecastMargin.toFixed(1)}%`}
          </strong>
        </article>
        <article className="detail-card">
          <span>Actual margin</span>
          <strong>
            {actualMargin === null ? "—" : `${actualMargin.toFixed(1)}%`}
          </strong>
        </article>
      </section>

      <form action={saveCommercial} className="form-card">
        <input type="hidden" name="project_id" value={id} />

        <div className="form-grid">
          <label className="field">
            <span>Order value £</span>
            <input
              name="order_value"
              type="number"
              min="0"
              step="0.01"
              defaultValue={commercial?.order_value ?? ""}
            />
          </label>

          <label className="field">
            <span>Variations £</span>
            <input
              name="variation_value"
              type="number"
              step="0.01"
              defaultValue={commercial?.variation_value ?? 0}
            />
          </label>

          <label className="field">
            <span>Estimated direct cost £</span>
            <input
              name="estimated_direct_cost"
              type="number"
              min="0"
              step="0.01"
              defaultValue={commercial?.estimated_direct_cost ?? ""}
            />
          </label>

          <label className="field">
            <span>Contingency %</span>
            <input
              name="contingency_pct"
              type="number"
              min="0"
              step="0.1"
              defaultValue={commercial?.contingency_pct ?? 5}
            />
          </label>

          <label className="field">
            <span>Target margin %</span>
            <input
              name="target_margin_pct"
              type="number"
              min="0"
              step="0.1"
              defaultValue={commercial?.target_margin_pct ?? ""}
            />
          </label>

          <label className="field">
            <span>Actual direct cost £</span>
            <input
              name="actual_direct_cost"
              type="number"
              min="0"
              step="0.01"
              defaultValue={commercial?.actual_direct_cost ?? ""}
            />
          </label>

          <label className="field">
            <span>Invoiced / applications £</span>
            <input
              name="invoiced_value"
              type="number"
              min="0"
              step="0.01"
              defaultValue={commercial?.invoiced_value ?? 0}
            />
          </label>

          <label className="field">
            <span>Paid £</span>
            <input
              name="paid_value"
              type="number"
              min="0"
              step="0.01"
              defaultValue={commercial?.paid_value ?? 0}
            />
          </label>

          <label className="field">
            <span>Retention £</span>
            <input
              name="retention_value"
              type="number"
              min="0"
              step="0.01"
              defaultValue={commercial?.retention_value ?? 0}
            />
          </label>

          <label className="field">
            <span>Payment terms days</span>
            <input
              name="payment_terms_days"
              type="number"
              min="0"
              step="1"
              defaultValue={commercial?.payment_terms_days ?? ""}
            />
          </label>

          <label className="field">
            <span>Due date</span>
            <input
              name="due_date"
              type="date"
              defaultValue={commercial?.due_date ?? ""}
            />
          </label>

          <label className="field">
            <span>Paid date</span>
            <input
              name="paid_date"
              type="date"
              defaultValue={commercial?.paid_date ?? ""}
            />
          </label>

          <label className="field field-wide">
            <span>Commercial notes</span>
            <textarea
              name="notes"
              rows={4}
              defaultValue={commercial?.notes ?? ""}
            />
          </label>
        </div>

        <div className="form-actions">
          <Link className="secondary-button" href="/commercial">
            Commercial overview
          </Link>
          <button className="primary-button" type="submit">
            Save commercial
          </button>
        </div>
      </form>

      <section className="foundation-note commercial-placeholder">
        <span className="pulse" />
        <div>
          <strong>5% contingency is automatic</strong>
          <p>
            Risk-adjusted cost is recalculated from direct cost plus contingency whenever this record is saved.
          </p>
        </div>
      </section>
    </div>
  );
}
