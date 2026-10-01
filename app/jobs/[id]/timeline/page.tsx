import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

type TimelinePageProps = {
  params: Promise<{ id: string }>;
};

const entityLabels: Record<string, string> = {
  projects: "Project",
  project_assignments: "Crew allocation",
  surveys: "Survey",
  rams_documents: "RAMS",
  documents: "Document",
  qa_records: "QA record",
  site_readings: "Site reading",
  batch_logs: "Batch log",
  project_actions: "Action",
  project_commercials: "Commercial record",
};

function actionLabel(action: string) {
  if (action === "insert") return "created";
  if (action === "update") return "updated";
  if (action === "delete") return "deleted";
  return action;
}

export default async function TimelinePage({ params }: TimelinePageProps) {
  const { id } = await params;
  const { supabase } = await requireAnyPermission(["dashboard:view"]);

  const [{ data: project }, { data: events }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, reference, title")
      .eq("id", id)
      .single(),
    supabase
      .from("audit_events")
      .select("id, actor_id, entity_type, entity_id, action, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (!project) notFound();

  const actorIds = Array.from(
    new Set((events || []).map((event) => event.actor_id).filter(Boolean))
  ) as string[];

  const { data: profiles } =
    actorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", actorIds)
      : { data: [] as Array<{ id: string; full_name: string }> };

  const profileById = new Map(
    (profiles || []).map((profile) => [profile.id, profile.full_name])
  );

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · history</p>
          <h1>{project.title}</h1>
          <p>
            Automatic project history from operational, technical, QA and
            permitted commercial changes.
          </p>
        </div>
        <Link className="secondary-button" href={`/jobs/${id}`}>
          Back to job
        </Link>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Audit trail</p>
            <h2>Recent activity</h2>
          </div>
          <span className="count-badge">{events?.length || 0}</span>
        </div>

        {events && events.length > 0 ? (
          <div className="audit-list">
            {events.map((event) => (
              <article key={event.id}>
                <span className="audit-dot" aria-hidden="true" />
                <div>
                  <strong>
                    {entityLabels[event.entity_type] || event.entity_type}{" "}
                    {actionLabel(event.action)}
                  </strong>
                  <small>
                    {event.actor_id
                      ? profileById.get(event.actor_id) || "Signed-in user"
                      : "System"}
                    {" · "}
                    {new Date(event.created_at).toLocaleString("en-GB", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <strong>No history yet.</strong>
            <p>New changes will be recorded automatically.</p>
          </div>
        )}
      </section>
    </div>
  );
}
