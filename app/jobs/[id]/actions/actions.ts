"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function addProjectAction(formData: FormData) {
  const { supabase } = await requireAnyPermission(["dashboard:view"]);
  const projectId = String(formData.get("project_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();

  if (!projectId || !title) redirect("/jobs");

  const { data: claimsData } = await supabase.auth.getClaims();

  const { error } = await supabase.from("project_actions").insert({
    project_id: projectId,
    title,
    category: String(formData.get("category") ?? "general"),
    priority: String(formData.get("priority") ?? "normal"),
    due_at: optionalText(formData.get("due_at")),
    detail: optionalText(formData.get("detail")),
    owner_user_id: claimsData?.claims?.sub ?? null,
  });

  if (error) {
    redirect(
      `/jobs/${projectId}/actions?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/");
  revalidatePath(`/jobs/${projectId}/actions`);
  redirect(`/jobs/${projectId}/actions`);
}

export async function completeProjectAction(formData: FormData) {
  const { supabase } = await requireAnyPermission(["dashboard:view"]);
  const projectId = String(formData.get("project_id") ?? "");
  const actionId = String(formData.get("action_id") ?? "");

  if (!projectId || !actionId) redirect("/jobs");

  const { data: claimsData } = await supabase.auth.getClaims();

  const { error } = await supabase
    .from("project_actions")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      completed_by: claimsData?.claims?.sub ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", actionId)
    .eq("project_id", projectId);

  if (error) {
    redirect(
      `/jobs/${projectId}/actions?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/");
  revalidatePath(`/jobs/${projectId}/actions`);
  redirect(`/jobs/${projectId}/actions`);
}
