"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/access";

function refresh(projectId: string) {
  revalidatePath("/documents");
  revalidatePath("/jobs/" + projectId);
  revalidatePath("/jobs/" + projectId + "/documents");
}

export async function acknowledgeDocument(formData: FormData) {
  const { supabase } = await requireAnyPermission(["documents:view"]);
  const projectId = String(formData.get("project_id") ?? "");
  const documentId = String(formData.get("document_id") ?? "");

  if (!projectId || !documentId) redirect("/jobs");

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) redirect("/login");

  const { error } = await supabase
    .from("document_acknowledgements")
    .upsert(
      {
        document_id: documentId,
        user_id: userId,
        acknowledged_at: new Date().toISOString(),
      },
      { onConflict: "document_id,user_id" }
    );

  if (error) {
    redirect(
      "/jobs/" +
        projectId +
        "/documents?error=" +
        encodeURIComponent(error.message)
    );
  }

  refresh(projectId);
  redirect("/jobs/" + projectId + "/documents");
}

export async function setDocumentStatus(formData: FormData) {
  const { supabase, role } = await requireAnyPermission(["documents:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const documentId = String(formData.get("document_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!projectId || !documentId || !["approved", "complete", "superseded"].includes(status)) {
    redirect("/jobs");
  }

  if (!can(role, "documents:edit")) {
    redirect("/jobs/" + projectId + "/documents?error=Document%20edit%20access%20required");
  }

  const { data: current } = await supabase
    .from("documents")
    .select("id,title,document_type,version")
    .eq("id", documentId)
    .eq("project_id", projectId)
    .single();

  if (!current) redirect("/jobs/" + projectId + "/documents");

  const { data: claimsData } = await supabase.auth.getClaims();
  const now = new Date().toISOString();

  if (status === "approved") {
    await supabase
      .from("documents")
      .update({
        status: "superseded",
        updated_at: now,
      })
      .eq("project_id", projectId)
      .eq("title", current.title)
      .eq("document_type", current.document_type)
      .eq("status", "approved")
      .neq("id", documentId);
  }

  const { error } = await supabase
    .from("documents")
    .update({
      status,
      approved_by:
        status === "approved" || status === "complete"
          ? claimsData?.claims?.sub ?? null
          : null,
      approved_at:
        status === "approved" || status === "complete" ? now : null,
      updated_at: now,
    })
    .eq("id", documentId)
    .eq("project_id", projectId);

  if (error) {
    redirect(
      "/jobs/" +
        projectId +
        "/documents?error=" +
        encodeURIComponent(error.message)
    );
  }

  refresh(projectId);
  redirect("/jobs/" + projectId + "/documents");
}
