import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { raiseVariation, verifyVariation, priceVariation, sendToClient, recordClientDecision, releaseVariation } from "./actions";

type VariationsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

function money(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default async function VariationsPage({
  params,
  searchParams,
}: VariationsPageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, role } = await requireAnyPermission(["jobs:view_all", "jobs:view_assigned"]);

  const [{ data: project }, { data: variations }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, reference, title")
      .eq("id", id)
      .single(),
    supabase
      .from("variations")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!project) notFound();

  const approvedTotal = (variations || [])
    .filter((variation) => variation.status === "approved")
    .reduce(
      (sum, variation) =>
        sum + Number(variation.approved_value ?? variation.submitted_value ?? 0),
      0
    );

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · restricted commercial</p>
          <h1>Variations</h1>
          <p>{project.title} · approved changes automatically feed the job value.</p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" href={`/jobs/${id}/commercial`}>
            Commercial
          </Link>
          <Link className="secondary-button" href={`/jobs/${id}`}>
            Job
          </Link>
        </div>
      </section>

      {error ? <p className="form-error page-error">{error}</p> : null}

      <section className="detail-grid">
        <article className="detail-card">
          <span>Variations</span>
          <strong>{variations?.length || 0}</strong>
        </article>
        <article className="detail-card">
          <span>Approved value</span>
          <strong>{money(approvedTotal)}</strong>
        </article>
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Register</p>
              <h2>Project variations</h2>
            </div>
          </div>

          {variations && variations.length > 0 ? (
            <div className="stack-list">
              {variations.map((variation) => (
                <article className="variation-card" key={variation.id}>
                  <div className="variation-head">
                    <span>
                      <strong>{variation.reference} · {variation.title}</strong>
                      <small>{variation.description || "No description"}</small>
                    </span>
                    <span className="status-badge">{variation.status}</span>
                  </div>

                  <div className="variation-values">
                    <span>
                      <small>Submitted</small>
                      <strong>{money(variation.submitted_value)}</strong>
                    </span>
                    <span>
                      <small>Approved</small>
                      <strong>{money(variation.approved_value)}</strong>
                    </span>
                    <span>
                      <small>Cost impact</small>
                      <strong>{money(variation.estimated_cost_impact)}</strong>
                    </span>
                    <span>
                      <small>Programme</small>
                      <strong>
                        {variation.programme_impact_days
                          ? `${variation.programme_impact_days} day(s)`
                          : "—"}
                      </strong>
                    </span>
                  </div>

                  {role === "supervisor" && ["site_submitted","proceed_at_risk"].includes(variation.status) ? (<form action={verifyVariation}><input type="hidden" name="project_id" value={id} /><input type="hidden" name="variation_id" value={variation.id} /><button className="text-button" type="submit">Technical facts verified</button></form>) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No variations.</strong>
              <p>Scope changes and client instructions can be controlled here.</p>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">New change</p>
              <h2>Submit to office</h2>
            </div>
          </div>

          <form action={raiseVariation} className="compact-form">
            <input type="hidden" name="project_id" value={id} />

            <label className="field">
              <span>What changed? *</span>
              <input name="title" required />
            </label>

            <label className="field">
              <span>Additional / omitted work</span>
              <textarea name="description" rows={4} />
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Who instructed it?</span>
                <input name="requested_by_name" />
              </label>
              <label className="field">
                <span>Company</span>
                <input name="requested_by_company" />
              </label>
              <label className="field">
                <span>Programme impact days</span>
                <input name="programme_impact_days" type="number" step="1" />
              </label>
              <label className="field">
                <span>Likely extra labour days</span>
                <input name="site_labour_days" type="number" step="0.5" />
              </label>
            </div>

            <button className="primary-button full-button" type="submit">
              Add variation
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
