"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

const allowedStages = new Set([
  "lead",
  "qualifying",
  "survey",
  "estimating",
  "quoted",
  "won",
  "lost",
]);

export async function updatePipelineStage(formData: FormData) {
  const { supabase } = await requireAnyPermission(["pipeline:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!projectId || !allowedStages.has(status)) redirect("/pipeline");

  const { error } = await supabase
    .from("projects")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    redirect(`/pipeline?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/");
  revalidatePath("/pipeline");
  revalidatePath(`/jobs/${projectId}`);
  redirect("/pipeline");
}
