import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/access";
import { DocumentUpload } from "@/components/document-upload";
import { acknowledgeDocument, setDocumentStatus } from "./actions";

type ProjectDocumentsProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

function fileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function ProjectDocumentsPage({
  params,
  searchParams,
}: ProjectDocumentsProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, role } = await requireAnyPermission(["documents:view"]);

  const { data: project } = await supabase
    .from("projects")
    .select("id, reference, title")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? "";

  const [{ data: documents }, { data: acknowledgements }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, document_type, title, version, status, file_name, file_size_bytes, acknowledgement_required, approved_at, created_at"
      )
      .eq("project_id", id)
      .is("qa_record_id", null)
      .order("created_at", { ascending: false }),
    userId
      ? supabase
          .from("document_acknowledgements")
          .select("document_id, acknowledged_at")
          .eq("user_id", userId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const acknowledged = new Map(
    (acknowledgements || []).map((row) => [
      row.document_id,
      row.acknowledged_at,
    ])
  );

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · documents</p>
          <h1>{project.title}</h1>
          <p>
            Controlled project files, RAMS, technical data, site evidence and handover documents.
          </p>
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
              <p className="eyebrow">Project pack</p>
              <h2>Documents</h2>
            </div>
            <span className="count-badge">{documents?.length || 0}</span>
          </div>

          {documents && documents.length > 0 ? (
            <div className="stack-list">
              {documents.map((document) => {
                const ackAt = acknowledged.get(document.id);

                return (
                  <div className="stack-row document-row" key={document.id}>
                    <span className="document-main">
                      <strong>{document.title}</strong>
                      <small>
                        {document.document_type.toUpperCase()} · Rev {document.version}
                        {document.file_size_bytes
                          ? ` · ${fileSize(document.file_size_bytes)}`
                          : ""}
                      </small>
                      {document.acknowledgement_required ? (
                        <small>
                          {ackAt
                            ? `Acknowledged ${new Date(ackAt).toLocaleDateString("en-GB")}`
                            : "Acknowledgement required"}
                        </small>
                      ) : null}
                    </span>

                    <div className="row-actions">
                      {can(role, "documents:edit") && document.status === "draft" ? (
                        <form action={setDocumentStatus}>
                          <input type="hidden" name="project_id" value={id} />
                          <input type="hidden" name="document_id" value={document.id} />
                          <input type="hidden" name="status" value="approved" />
                          <button className="text-button" type="submit">
                            Approve
                          </button>
                        </form>
                      ) : null}

                      {can(role, "documents:edit") &&
                      ["approved", "complete"].includes(document.status) ? (
                        <form action={setDocumentStatus}>
                          <input type="hidden" name="project_id" value={id} />
                          <input type="hidden" name="document_id" value={document.id} />
                          <input type="hidden" name="status" value="superseded" />
                          <button className="text-button danger-text" type="submit">
                            Supersede
                          </button>
                        </form>
                      ) : null}

                      <Link
                        className="text-button"
                        href={`/documents/${document.id}/download`}
                      >
                        Open
                      </Link>

                      {document.acknowledgement_required && !ackAt ? (
                        <form action={acknowledgeDocument}>
                          <input type="hidden" name="project_id" value={id} />
                          <input
                            type="hidden"
                            name="document_id"
                            value={document.id}
                          />
                          <button className="text-button" type="submit">
                            Acknowledge
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No documents yet.</strong>
              <p>Upload the first controlled file for this project.</p>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Private storage</p>
              <h2>Upload</h2>
            </div>
          </div>

          {can(role, "documents:edit") || can(role, "qa:complete") ? (
            <DocumentUpload projectId={id} />
          ) : (
            <div className="empty-state compact-empty">
              <strong>Read-only access.</strong>
              <p>Your role can view this project pack but cannot upload files.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
