import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { addProjectAction, completeProjectAction } from "./actions";

type ActionPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

function when(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function ActionPage({
  params,
  searchParams,
}: ActionPageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase } = await requireAnyPermission(["dashboard:view"]);

  const [{ data: project }, { data: actions }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, reference, title")
      .eq("id", id)
      .single(),
    supabase
      .from("project_actions")
      .select("id, title, category, priority, due_at, detail, status, created_at, completed_at")
      .eq("project_id", id)
      .order("status")
      .order("due_at", { ascending: true, nullsFirst: false }),
  ]);

  if (!project) notFound();

  const open = (actions || []).filter((action) => action.status === "open");
  const done = (actions || []).filter((action) => action.status === "done");

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · actions</p>
          <h1>{project.title}</h1>
          <p>Anything that needs chasing belongs here with an owner, priority and due date.</p>
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
              <p className="eyebrow">Open</p>
              <h2>Needs attention</h2>
            </div>
            <span className="count-badge">{open.length}</span>
          </div>

          {open.length > 0 ? (
            <div className="stack-list">
              {open.map((action) => (
                <div className="stack-row stack-row-action" key={action.id}>
                  <span>
                    <strong>{action.title}</strong>
                    <small>
                      {action.category.replaceAll("_", " ")} · {action.priority} · {when(action.due_at)}
                    </small>
                    {action.detail ? <small>{action.detail}</small> : null}
                  </span>
                  <form action={completeProjectAction}>
                    <input type="hidden" name="project_id" value={id} />
                    <input type="hidden" name="action_id" value={action.id} />
                    <button className="text-button" type="submit">
                      Done
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <strong>Nothing open.</strong>
              <p>No outstanding actions on this project.</p>
            </div>
          )}

          {done.length > 0 ? (
            <details className="completed-actions">
              <summary>Completed ({done.length})</summary>
              <div className="stack-list">
                {done.slice(0, 20).map((action) => (
                  <div className="stack-row" key={action.id}>
                    <span>
                      <strong>{action.title}</strong>
                      <small>
                        Completed {action.completed_at ? when(action.completed_at) : ""}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">New</p>
              <h2>Add action</h2>
            </div>
          </div>

          <form action={addProjectAction} className="compact-form">
            <input type="hidden" name="project_id" value={id} />

            <label className="field">
              <span>Action *</span>
              <input name="title" required placeholder="Confirm crew / chase quote / issue RAMS..." />
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Category</span>
                <select name="category" defaultValue="general">
                  <option value="general">General</option>
                  <option value="survey">Survey</option>
                  <option value="quote">Quote</option>
                  <option value="technical">Technical</option>
                  <option value="rams">RAMS</option>
                  <option value="qa">QA</option>
                  <option value="crew">Crew</option>
                  <option value="commercial">Commercial</option>
                  <option value="invoice">Invoice</option>
                  <option value="handover">Handover</option>
                </select>
              </label>

              <label className="field">
                <span>Priority</span>
                <select name="priority" defaultValue="normal">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>Due</span>
              <input name="due_at" type="datetime-local" />
            </label>

            <label className="field">
              <span>Detail</span>
              <textarea name="detail" rows={3} />
            </label>

            <button className="primary-button full-button" type="submit">
              Add action
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
