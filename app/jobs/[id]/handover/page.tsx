import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import {
  acceptSnag,
  addSnag,
  completeSnag,
  saveHandover,
} from "./actions";

type HandoverPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function HandoverPage({
  params,
  searchParams,
}: HandoverPageProps) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const { supabase, role } = await requireAnyPermission(["qa:view"]);

  const [
    { data: project },
    { data: snags },
    { data: people },
    { data: handover },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, reference, title, status")
      .eq("id", id)
      .single(),
    supabase
      .from("snags")
      .select("id, title, detail, status, priority, due_on, owner_person_id, people(full_name)")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("people")
      .select("id, full_name")
      .eq("active", true)
      .order("full_name"),
    supabase
      .from("handover_records")
      .select("*")
      .eq("project_id", id)
      .maybeSingle(),
  ]);

  if (!project) notFound();

  const canManageHandover = ["owner", "office", "commercial", "supervisor"].includes(role);
  const openSnags = (snags || []).filter((snag) =>
    ["open", "in_progress", "complete"].includes(snag.status)
  );

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · close-out</p>
          <h1>Handover</h1>
          <p>{project.title} · snags, completion information and final acceptance.</p>
        </div>
        <div className="heading-actions">
          <Link
            className="secondary-button"
            href={`/jobs/${id}/handover/report`}
          >
            QA / handover report
          </Link>
          <Link className="secondary-button" href={`/jobs/${id}`}>
            Back to job
          </Link>
        </div>
      </section>

      {error ? <p className="form-error page-error">{error}</p> : null}
      {saved ? <p className="form-success page-error">Handover record saved.</p> : null}

      <section className="detail-grid">
        <article className="detail-card">
          <span>Open / awaiting acceptance</span>
          <strong>{openSnags.length}</strong>
        </article>
        <article className="detail-card">
          <span>Handover status</span>
          <strong className="status-badge">{handover?.status || "draft"}</strong>
        </article>
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Defects / outstanding work</p>
              <h2>Snag register</h2>
            </div>
            <span className="count-badge">{snags?.length || 0}</span>
          </div>

          {snags && snags.length > 0 ? (
            <div className="stack-list">
              {snags.map((snag) => {
                const person = Array.isArray(snag.people)
                  ? snag.people[0]
                  : snag.people;

                return (
                  <article className="stack-row stack-row-action" key={snag.id}>
                    <span>
                      <strong>{snag.title}</strong>
                      <small>
                        {snag.priority}
                        {person?.full_name ? ` · ${person.full_name}` : ""}
                        {snag.due_on ? ` · due ${snag.due_on}` : ""}
                      </small>
                      {snag.detail ? <small>{snag.detail}</small> : null}
                    </span>

                    <div className="row-actions">
                      <span className="status-badge">{snag.status.replace("_", " ")}</span>

                      {["open", "in_progress"].includes(snag.status) ? (
                        <form action={completeSnag}>
                          <input type="hidden" name="project_id" value={id} />
                          <input type="hidden" name="snag_id" value={snag.id} />
                          <button className="text-button" type="submit">
                            Complete
                          </button>
                        </form>
                      ) : null}

                      {snag.status === "complete" && canManageHandover ? (
                        <form action={acceptSnag}>
                          <input type="hidden" name="project_id" value={id} />
                          <input type="hidden" name="snag_id" value={snag.id} />
                          <button className="text-button" type="submit">
                            Accept
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No snags recorded.</strong>
              <p>Use this for actual outstanding items, not routine chatter.</p>
            </div>
          )}

          <details className="completed-actions">
            <summary>Add snag</summary>
            <form action={addSnag} className="compact-form rams-add-form">
              <input type="hidden" name="project_id" value={id} />

              <label className="field">
                <span>Title *</span>
                <input name="title" required />
              </label>

              <label className="field">
                <span>Detail</span>
                <textarea name="detail" rows={3} />
              </label>

              <div className="form-grid">
                <label className="field">
                  <span>Priority</span>
                  <select name="priority" defaultValue="normal">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>

                <label className="field">
                  <span>Owner</span>
                  <select name="owner_person_id" defaultValue="">
                    <option value="">Unassigned</option>
                    {(people || []).map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Due</span>
                  <input name="due_on" type="date" />
                </label>
              </div>

              <button className="secondary-button full-button" type="submit">
                Add snag
              </button>
            </form>
          </details>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Completion pack</p>
              <h2>Handover record</h2>
            </div>
          </div>

          {canManageHandover ? (
            <form action={saveHandover} className="compact-form">
              <input type="hidden" name="project_id" value={id} />

              <div className="form-grid">
                <label className="field">
                  <span>Status</span>
                  <select name="status" defaultValue={handover?.status ?? "draft"}>
                    <option value="draft">Draft</option>
                    <option value="ready">Ready</option>
                    <option value="issued">Issued</option>
                    <option value="accepted">Accepted</option>
                  </select>
                </label>

                <label className="field">
                  <span>Completion date</span>
                  <input
                    name="completion_date"
                    type="date"
                    defaultValue={handover?.completion_date ?? ""}
                  />
                </label>
              </div>

              <label className="field">
                <span>Client contact</span>
                <input
                  name="client_contact_name"
                  defaultValue={handover?.client_contact_name ?? ""}
                />
              </label>

              <label className="field">
                <span>Care / cleaning information</span>
                <textarea
                  name="care_information"
                  rows={4}
                  defaultValue={handover?.care_information ?? ""}
                />
              </label>

              <label className="field">
                <span>Warranty information</span>
                <textarea
                  name="warranty_information"
                  rows={4}
                  defaultValue={handover?.warranty_information ?? ""}
                />
              </label>

              <label className="field">
                <span>Outstanding items / exclusions</span>
                <textarea
                  name="outstanding_items"
                  rows={4}
                  defaultValue={handover?.outstanding_items ?? ""}
                />
              </label>

              <label className="field">
                <span>Accepted by</span>
                <input
                  name="accepted_by_name"
                  defaultValue={handover?.accepted_by_name ?? ""}
                  placeholder="Client representative name"
                />
              </label>

              <button className="primary-button full-button" type="submit">
                Save handover
              </button>
            </form>
          ) : handover ? (
            <dl className="detail-list">
              <div><dt>Status</dt><dd>{handover.status}</dd></div>
              <div><dt>Completion</dt><dd>{handover.completion_date || "—"}</dd></div>
              <div><dt>Care</dt><dd>{handover.care_information || "—"}</dd></div>
              <div><dt>Warranty</dt><dd>{handover.warranty_information || "—"}</dd></div>
              <div><dt>Outstanding</dt><dd>{handover.outstanding_items || "None"}</dd></div>
            </dl>
          ) : (
            <div className="empty-state compact-empty">
              <strong>Handover not prepared yet.</strong>
              <p>Management or the supervisor will issue the completion record.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
