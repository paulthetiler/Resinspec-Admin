"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

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
      `/jobs/${projectId}/documents?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath(`/jobs/${projectId}/documents`);
  redirect(`/jobs/${projectId}/documents`);
}
