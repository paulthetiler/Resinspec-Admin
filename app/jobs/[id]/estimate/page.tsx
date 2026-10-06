import Link from "next/link";
import { randomUUID } from "crypto";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  addEstimateItem,
  adoptEstimateAsBudget,
  createEstimate,
  createEstimateRevision,
  deleteEstimateItem,
  saveEstimateSettings,
  setEstimateStatus,
} from "./actions";

type EstimatePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; adopted?: string }>;
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export default async function EstimatePage({
  params,
  searchParams,
}: EstimatePageProps) {
  const { id } = await params;
  const messages = await searchParams;
  const { supabase } = await requireAnyPermission(["commercial:view"]);

  const [{ data: project }, { data: estimates }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, reference, title, area_m2, status")
      .eq("id", id)
      .single(),
    supabase
      .from("estimates")
      .select("*")
      .eq("project_id", id)
      .order("version", { ascending: false }),
  ]);

  if (!project) notFound();

  const estimate = estimates?.[0] ?? null;
  const { data: items } = estimate
    ? await supabase
        .from("estimate_items")
        .select("*")
        .eq("estimate_id", estimate.id)
        .order("sort_order")
        .order("created_at")
    : { data: [] };

  const editable = estimate?.status === "draft";
  const pricePerM2 =
    estimate?.area_m2 && Number(estimate.area_m2) > 0
      ? Number(estimate.sell_price) / Number(estimate.area_m2)
      : null;

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · estimator</p>
          <h1>{project.title}</h1>
          <p>
            Real cost build-up only. Labour, materials, equipment and other
            costs are entered from verified job information rather than guessed
            resin rates.
          </p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" href={"/jobs/" + id + "/commercial"}>
            Commercial
          </Link>
          <Link className="secondary-button" href={"/jobs/" + id}>
            Job
          </Link>
        </div>
      </section>

      {messages.error ? (
        <p className="form-error page-error">{messages.error}</p>
      ) : null}
      {messages.saved ? (
        <p className="form-success page-error">Estimate settings saved.</p>
      ) : null}
      {messages.adopted ? (
        <p className="form-success page-error">
          Estimate adopted as the live project budget.
        </p>
      ) : null}

      {!estimate ? (
        <section className="panel">
          <div className="empty-state">
            <strong>No estimate revision yet.</strong>
            <p>Create the first cost build-up for this project.</p>
            <form action={createEstimate}>
              <input type="hidden" name="project_id" value={id} />
              <PendingSubmitButton
                idleLabel="Create estimate"
                pendingLabel="Creating estimate…"
              />
            </form>
          </div>
        </section>
      ) : (
        <>
          <section className="estimate-toolbar">
            <span className="status-badge">
              {estimate.status.replace("_", " ")}
            </span>
            <span>Revision {estimate.version}</span>
            <span>
              {estimate.area_m2 ? String(estimate.area_m2) + " m²" : "Area TBC"}
            </span>

            <div className="heading-actions">
              {editable ? (
                <>
                  <form action={setEstimateStatus}>
                    <input type="hidden" name="project_id" value={id} />
                    <input type="hidden" name="estimate_id" value={estimate.id} />
                    <input type="hidden" name="status" value="internal_review" />
                    <PendingSubmitButton
                      idleLabel="Internal review"
                      pendingLabel="Updating…"
                      className="text-button"
                    />
                  </form>
                  <form action={setEstimateStatus}>
                    <input type="hidden" name="project_id" value={id} />
                    <input type="hidden" name="estimate_id" value={estimate.id} />
                    <input type="hidden" name="status" value="issued" />
                    <PendingSubmitButton
                      idleLabel="Issue"
                      pendingLabel="Issuing…"
                      className="text-button"
                    />
                  </form>
                </>
              ) : null}

              {["internal_review", "issued"].includes(estimate.status) ? (
                <form action={setEstimateStatus}>
                  <input type="hidden" name="project_id" value={id} />
                  <input type="hidden" name="estimate_id" value={estimate.id} />
                  <input type="hidden" name="status" value="accepted" />
                  <button className="text-button" type="submit">
                    Accept
                  </button>
                </form>
              ) : null}

              {!editable ? (
                <form action={createEstimateRevision}>
                  <input type="hidden" name="project_id" value={id} />
                  <input type="hidden" name="estimate_id" value={estimate.id} />
                  <PendingSubmitButton
                    idleLabel="New revision"
                    pendingLabel="Creating…"
                    className="text-button"
                  />
                </form>
              ) : null}

              {["issued", "accepted"].includes(estimate.status) ? (
                <form action={adoptEstimateAsBudget}>
                  <input type="hidden" name="project_id" value={id} />
                  <input type="hidden" name="estimate_id" value={estimate.id} />
                  <PendingSubmitButton
                    idleLabel="Adopt as budget"
                    pendingLabel="Adopting…"
                    className="text-button"
                  />
                </form>
              ) : null}
            </div>
          </section>

          <section className="detail-grid">
            <article className="detail-card">
              <span>Direct cost</span>
              <strong>{money(estimate.direct_cost)}</strong>
            </article>
            <article className="detail-card">
              <span>Risk-adjusted cost</span>
              <strong>{money(estimate.risk_adjusted_cost)}</strong>
            </article>
            <article className="detail-card">
              <span>Sell price</span>
              <strong>{money(estimate.sell_price)}</strong>
            </article>
            <article className="detail-card">
              <span>Sell £/m²</span>
              <strong>{pricePerM2 === null ? "—" : money(pricePerM2)}</strong>
            </article>
          </section>

          <div className="two-column estimate-columns">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Cost build-up</p>
                  <h2>Estimate lines</h2>
                </div>
                <span className="count-badge">{items?.length || 0}</span>
              </div>

              {items && items.length > 0 ? (
                <div className="estimate-lines">
                  {items.map((item) => {
                    const total = Number(item.quantity) * Number(item.unit_cost);
                    return (
                      <article key={item.id}>
                        <div>
                          <span className="status-badge">{item.category}</span>
                          <strong>{item.description}</strong>
                          <small>
                            {item.quantity} {item.unit || "unit"} ×{" "}
                            {money(item.unit_cost)}
                          </small>
                          {item.notes ? <small>{item.notes}</small> : null}
                        </div>
                        <div className="estimate-line-total">
                          <strong>{money(total)}</strong>
                          {editable ? (
                            <form action={deleteEstimateItem}>
                              <input type="hidden" name="project_id" value={id} />
                              <input
                                type="hidden"
                                name="estimate_id"
                                value={estimate.id}
                              />
                              <input type="hidden" name="item_id" value={item.id} />
                              <PendingSubmitButton
                                idleLabel="Remove"
                                pendingLabel="Removing…"
                                className="text-button danger-text"
                              />
                            </form>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state compact-empty">
                  <strong>No cost lines yet.</strong>
                  <p>Add real cost components below.</p>
                </div>
              )}

              {editable ? (
                <details className="completed-actions" open>
                  <summary>Add cost line</summary>
                  <form
                    action={addEstimateItem}
                    className="compact-form rams-add-form"
                  >
                    <input type="hidden" name="project_id" value={id} />
                    <input
                      type="hidden"
                      name="estimate_id"
                      value={estimate.id}
                    />
                    <input
                      type="hidden"
                      name="submission_key"
                      value={randomUUID()}
                    />

                    <div className="form-grid">
                      <label className="field">
                        <span>Category</span>
                        <select name="category" defaultValue="labour">
                          <option value="labour">Labour</option>
                          <option value="materials">Materials</option>
                          <option value="equipment">Equipment</option>
                          <option value="preparation">Preparation</option>
                          <option value="waste">Waste</option>
                          <option value="travel">Travel</option>
                          <option value="accommodation">Accommodation</option>
                          <option value="subcontract">Subcontract</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Description *</span>
                        <input name="description" required />
                      </label>
                    </div>

                    <div className="form-grid">
                      <label className="field">
                        <span>Quantity</span>
                        <input
                          name="quantity"
                          type="number"
                          min="0"
                          step="0.001"
                          defaultValue="1"
                        />
                      </label>
                      <label className="field">
                        <span>Unit</span>
                        <input
                          name="unit"
                          list="estimate-unit-options"
                          placeholder="day / kg / m² / item"
                        />
                        <datalist id="estimate-unit-options">
                          <option value="day" />
                          <option value="hour" />
                          <option value="m²" />
                          <option value="kg" />
                          <option value="bag" />
                          <option value="kit" />
                          <option value="item" />
                          <option value="mile" />
                          <option value="night" />
                        </datalist>
                      </label>
                      <label className="field">
                        <span>Unit cost £</span>
                        <input
                          name="unit_cost"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue="0"
                        />
                      </label>
                    </div>

                    <label className="field">
                      <span>Notes</span>
                      <input name="notes" />
                    </label>

                    <PendingSubmitButton
                      idleLabel="Add cost line"
                      pendingLabel="Adding cost…"
                      className="secondary-button full-button"
                    />
                    <small className="estimate-submit-hint">
                      One tap is enough. The button locks while the cost is being saved.
                    </small>
                  </form>
                </details>
              ) : null}
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Pricing controls</p>
                  <h2>Risk & margin</h2>
                </div>
              </div>

              {editable ? (
                <form action={saveEstimateSettings} className="compact-form">
                  <input type="hidden" name="project_id" value={id} />
                  <input
                    type="hidden"
                    name="estimate_id"
                    value={estimate.id}
                  />

                  <label className="field">
                    <span>Area m²</span>
                    <input
                      name="area_m2"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={
                        estimate.area_m2 ?? project.area_m2 ?? ""
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Contingency %</span>
                    <input
                      name="contingency_pct"
                      type="number"
                      min="0"
                      max="99"
                      step="0.1"
                      defaultValue={estimate.contingency_pct}
                    />
                  </label>

                  <label className="field">
                    <span>Target margin %</span>
                    <input
                      name="target_margin_pct"
                      type="number"
                      min="0"
                      max="94"
                      step="0.1"
                      defaultValue={estimate.target_margin_pct}
                    />
                  </label>

                  <label className="field">
                    <span>Estimator notes</span>
                    <textarea
                      name="notes"
                      rows={5}
                      defaultValue={estimate.notes ?? ""}
                    />
                  </label>

                  <PendingSubmitButton
                    idleLabel="Save pricing controls"
                    pendingLabel="Saving pricing…"
                    className="primary-button full-button"
                  />
                </form>
              ) : (
                <dl className="detail-list">
                  <div>
                    <dt>Contingency</dt>
                    <dd>{estimate.contingency_pct}%</dd>
                  </div>
                  <div>
                    <dt>Target margin</dt>
                    <dd>{estimate.target_margin_pct}%</dd>
                  </div>
                  <div>
                    <dt>Notes</dt>
                    <dd>{estimate.notes || "—"}</dd>
                  </div>
                </dl>
              )}

              <div className="estimate-formula">
                <span>Direct cost</span>
                <strong>{money(estimate.direct_cost)}</strong>
                <span>+ {estimate.contingency_pct}% contingency</span>
                <strong>{money(estimate.risk_adjusted_cost)}</strong>
                <span>÷ (1 − {estimate.target_margin_pct}% margin)</span>
                <strong>{money(estimate.sell_price)}</strong>
              </div>
            </section>
          </div>

          {estimates && estimates.length > 1 ? (
            <details className="completed-actions estimate-history">
              <summary>
                Previous revisions ({estimates.length - 1})
              </summary>
              <div className="stack-list">
                {estimates.slice(1).map((revision) => (
                  <div className="stack-row" key={revision.id}>
                    <span>
                      <strong>Revision {revision.version}</strong>
                      <small>
                        {revision.status.replace("_", " ")} ·{" "}
                        {money(revision.sell_price)}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
