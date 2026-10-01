import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/access";
import {
  acknowledgeRams,
  addMethodStep,
  addRisk,
  approveRams,
  createStandardRams,
  saveRamsSummary,
} from "./actions";

type RamsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    approved?: string;
    ack?: string;
  }>;
};

function score(likelihood: number, severity: number) {
  return likelihood * severity;
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function RamsPage({
  params,
  searchParams,
}: RamsPageProps) {
  const { id } = await params;
  const messages = await searchParams;
  const { supabase, role } = await requireAnyPermission(["documents:view"]);

  const [{ data: project }, { data: versions }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, reference, title, scope_summary")
      .eq("id", id)
      .single(),
    supabase
      .from("rams_documents")
      .select("*")
      .eq("project_id", id)
      .order("version", { ascending: false }),
  ]);

  if (!project) notFound();

  const rams = versions?.[0] ?? null;
  const editable =
    !!rams && rams.status === "draft" && can(role, "documents:edit");

  const [{ data: risks }, { data: steps }, { data: acks }, claimsResult] = rams
    ? await Promise.all([
        supabase
          .from("rams_risks")
          .select("*")
          .eq("rams_id", rams.id)
          .order("sort_order"),
        supabase
          .from("rams_steps")
          .select("*")
          .eq("rams_id", rams.id)
          .order("step_order"),
        supabase
          .from("rams_acknowledgements")
          .select("user_id, acknowledged_at")
          .eq("rams_id", rams.id),
        supabase.auth.getClaims(),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: { claims: null } },
      ];

  const currentUserId = claimsResult.data?.claims?.sub ?? "";
  const selfAck = (acks || []).find((ack) => ack.user_id === currentUserId);
  const canApprove = editable && (role === "owner" || role === "supervisor");

  const acknowledgementUserIds = (acks || []).map((ack) => ack.user_id);
  const { data: acknowledgementProfiles } =
    acknowledgementUserIds.length > 0 &&
    (role === "owner" || role === "office" || role === "supervisor")
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", acknowledgementUserIds)
      : { data: [] as Array<{ id: string; full_name: string }> };

  const profileById = new Map(
    (acknowledgementProfiles || []).map((profile) => [
      profile.id,
      profile.full_name,
    ])
  );

  return (
    <div className="standalone-page rams-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · RAMS</p>
          <h1>{project.title}</h1>
          <p>
            Project-specific risk assessment, method statement and crew briefing record.
          </p>
        </div>
        <Link className="secondary-button" href={`/jobs/${id}`}>
          Back to job
        </Link>
      </section>

      {messages.error ? (
        <p className="form-error page-error">{messages.error}</p>
      ) : null}
      {messages.saved ? (
        <p className="form-success page-error">RAMS draft saved.</p>
      ) : null}
      {messages.approved ? (
        <p className="form-success page-error">RAMS approved and locked.</p>
      ) : null}
      {messages.ack ? (
        <p className="form-success page-error">Briefing acknowledged.</p>
      ) : null}

      {!rams ? (
        <section className="panel">
          <div className="empty-state rams-empty">
            <strong>No RAMS created for this project.</strong>
            <p>
              The standard draft gives you a starting point only. It still needs project-specific review before approval.
            </p>
            {can(role, "documents:edit") ? (
              <form action={createStandardRams}>
                <input type="hidden" name="project_id" value={id} />
                <button className="primary-button" type="submit">
                  Create standard RAMS draft
                </button>
              </form>
            ) : null}
          </div>
        </section>
      ) : (
        <>
          <section className="rams-statusbar">
            <span className="status-badge">{rams.status}</span>
            <span>Revision {rams.version}</span>
            <span>
              {rams.approved_at
                ? `Approved ${dateTime(rams.approved_at)}`
                : "Not approved"}
            </span>
            <span>{acks?.length || 0} acknowledgement(s)</span>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Document controls</p>
                <h2>{rams.title}</h2>
              </div>
            </div>

            {editable ? (
              <form action={saveRamsSummary} className="compact-form">
                <input type="hidden" name="project_id" value={id} />
                <input type="hidden" name="rams_id" value={rams.id} />

                <label className="field">
                  <span>Title</span>
                  <input name="title" defaultValue={rams.title} required />
                </label>

                <label className="field">
                  <span>Scope</span>
                  <textarea
                    name="scope_summary"
                    rows={4}
                    defaultValue={rams.scope_summary ?? project.scope_summary ?? ""}
                  />
                </label>

                <div className="form-grid">
                  <label className="field">
                    <span>Access / segregation</span>
                    <textarea
                      name="access_control"
                      rows={4}
                      defaultValue={rams.access_control ?? ""}
                    />
                  </label>

                  <label className="field">
                    <span>PPE</span>
                    <textarea
                      name="ppe_requirements"
                      rows={4}
                      defaultValue={rams.ppe_requirements ?? ""}
                    />
                  </label>

                  <label className="field">
                    <span>Emergency arrangements</span>
                    <textarea
                      name="emergency_arrangements"
                      rows={4}
                      defaultValue={rams.emergency_arrangements ?? ""}
                    />
                  </label>

                  <label className="field">
                    <span>Environmental controls</span>
                    <textarea
                      name="environmental_controls"
                      rows={4}
                      defaultValue={rams.environmental_controls ?? ""}
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Welfare</span>
                  <textarea
                    name="welfare_requirements"
                    rows={3}
                    defaultValue={rams.welfare_requirements ?? ""}
                  />
                </label>

                <button className="secondary-button full-button" type="submit">
                  Save document controls
                </button>
              </form>
            ) : (
              <dl className="detail-list">
                <div><dt>Scope</dt><dd>{rams.scope_summary || "—"}</dd></div>
                <div><dt>Access / segregation</dt><dd>{rams.access_control || "—"}</dd></div>
                <div><dt>PPE</dt><dd>{rams.ppe_requirements || "—"}</dd></div>
                <div><dt>Emergency</dt><dd>{rams.emergency_arrangements || "—"}</dd></div>
                <div><dt>Environmental</dt><dd>{rams.environmental_controls || "—"}</dd></div>
                <div><dt>Welfare</dt><dd>{rams.welfare_requirements || "—"}</dd></div>
              </dl>
            )}
          </section>

          <section className="panel rams-section">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Risk assessment</p>
                <h2>Hazards & controls</h2>
              </div>
              <span className="count-badge">{risks?.length || 0}</span>
            </div>

            <div className="risk-table-wrap">
              <table className="data-table risk-table">
                <thead>
                  <tr>
                    <th>Hazard</th>
                    <th>People</th>
                    <th>Initial</th>
                    <th>Controls</th>
                    <th>Residual</th>
                  </tr>
                </thead>
                <tbody>
                  {(risks || []).map((risk) => (
                    <tr key={risk.id}>
                      <td><strong>{risk.hazard}</strong></td>
                      <td>{risk.persons_at_risk || "—"}</td>
                      <td>
                        <span className="risk-score">
                          {score(risk.initial_likelihood, risk.initial_severity)}
                        </span>
                        <small>{risk.initial_likelihood} × {risk.initial_severity}</small>
                      </td>
                      <td>{risk.controls}</td>
                      <td>
                        <span className="risk-score residual">
                          {score(risk.residual_likelihood, risk.residual_severity)}
                        </span>
                        <small>{risk.residual_likelihood} × {risk.residual_severity}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editable ? (
              <details className="completed-actions">
                <summary>Add project-specific risk</summary>
                <form action={addRisk} className="compact-form rams-add-form">
                  <input type="hidden" name="project_id" value={id} />
                  <input type="hidden" name="rams_id" value={rams.id} />

                  <label className="field">
                    <span>Hazard *</span>
                    <input name="hazard" required />
                  </label>

                  <label className="field">
                    <span>Persons at risk</span>
                    <input name="persons_at_risk" />
                  </label>

                  <div className="form-grid">
                    <label className="field">
                      <span>Initial likelihood 1–5</span>
                      <input name="initial_likelihood" type="number" min="1" max="5" defaultValue="3" />
                    </label>
                    <label className="field">
                      <span>Initial severity 1–5</span>
                      <input name="initial_severity" type="number" min="1" max="5" defaultValue="3" />
                    </label>
                  </div>

                  <label className="field">
                    <span>Controls *</span>
                    <textarea name="controls" rows={4} required />
                  </label>

                  <div className="form-grid">
                    <label className="field">
                      <span>Residual likelihood 1–5</span>
                      <input name="residual_likelihood" type="number" min="1" max="5" defaultValue="1" />
                    </label>
                    <label className="field">
                      <span>Residual severity 1–5</span>
                      <input name="residual_severity" type="number" min="1" max="5" defaultValue="3" />
                    </label>
                  </div>

                  <button className="secondary-button full-button" type="submit">
                    Add risk
                  </button>
                </form>
              </details>
            ) : null}
          </section>

          <section className="panel rams-section">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Method statement</p>
                <h2>Work sequence</h2>
              </div>
              <span className="count-badge">{steps?.length || 0}</span>
            </div>

            <div className="method-sequence">
              {(steps || []).map((step) => (
                <article key={step.id}>
                  <span className="method-number">{step.step_order}</span>
                  <div>
                    <strong>{step.activity}</strong>
                    <p>{step.method}</p>
                    {step.hold_point ? (
                      <small className="hold-point">QA hold point</small>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            {editable ? (
              <details className="completed-actions">
                <summary>Add method step</summary>
                <form action={addMethodStep} className="compact-form rams-add-form">
                  <input type="hidden" name="project_id" value={id} />
                  <input type="hidden" name="rams_id" value={rams.id} />

                  <div className="form-grid">
                    <label className="field">
                      <span>Order</span>
                      <input name="step_order" type="number" step="10" defaultValue="100" />
                    </label>
                    <label className="field">
                      <span>Activity *</span>
                      <input name="activity" required />
                    </label>
                  </div>

                  <label className="field">
                    <span>Method *</span>
                    <textarea name="method" rows={4} required />
                  </label>

                  <label className="check-row">
                    <input name="hold_point" type="checkbox" />
                    <span>Make this a QA hold point</span>
                  </label>

                  <button className="secondary-button full-button" type="submit">
                    Add method step
                  </button>
                </form>
              </details>
            ) : null}
          </section>

          <section className="panel rams-section">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Approval & briefing</p>
                <h2>Crew acknowledgement</h2>
              </div>
            </div>

            {rams.status === "draft" ? (
              canApprove ? (
                <form action={approveRams}>
                  <input type="hidden" name="project_id" value={id} />
                  <input type="hidden" name="rams_id" value={rams.id} />
                  <div className="approval-box">
                    <p>
                      Approval confirms this RAMS has been reviewed for the actual project and is not being issued as an unchecked template.
                    </p>
                    <button className="primary-button" type="submit">
                      Approve & lock revision {rams.version}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="approval-box">
                  <p>Owner or Supervisor approval is required before crew acknowledgement.</p>
                </div>
              )
            ) : rams.status === "approved" ? (
              <div className="approval-box">
                <p>
                  Approved revision {rams.version}. Each signed-in crew member acknowledges that they have received and understood the briefing; this does not replace supervision or competency.
                </p>
                {selfAck ? (
                  <span className="status-badge">
                    Acknowledged {dateTime(selfAck.acknowledged_at)}
                  </span>
                ) : (
                  <form action={acknowledgeRams}>
                    <input type="hidden" name="project_id" value={id} />
                    <input type="hidden" name="rams_id" value={rams.id} />
                    <button className="primary-button" type="submit">
                      I acknowledge this briefing
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="approval-box">
                <p>This revision has been superseded.</p>
              </div>
            )}

            {acks && acks.length > 0 && (role === "owner" || role === "office" || role === "supervisor") ? (
              <div className="compact-log">
                {acks.map((ack) => (
                  <div key={ack.user_id}>
                    <span>
                      <strong>{profileById.get(ack.user_id) || "Crew member"}</strong>
                      <small>Briefing acknowledged</small>
                    </span>
                    <small>{dateTime(ack.acknowledged_at)}</small>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
