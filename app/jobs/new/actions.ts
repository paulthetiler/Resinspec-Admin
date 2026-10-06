"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { suggestedNextAction } from "@/lib/project-next-actions";

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function createProject(formData: FormData) {
  const { supabase } = await requireAnyPermission(["jobs:edit"]);

  const title = String(formData.get("title") ?? "").trim();
  const status = String(formData.get("status") ?? "lead");
  const areaRaw = String(formData.get("area_m2") ?? "").trim();

  if (!title) {
    redirect("/jobs/new?error=Project%20title%20is%20required");
  }

  const area = areaRaw ? Number(areaRaw) : null;
  if (area !== null && (!Number.isFinite(area) || area < 0)) {
    redirect("/jobs/new?error=Enter%20a%20valid%20floor%20area");
  }

  const nextAction =
    optionalText(formData.get("next_action")) ?? suggestedNextAction(status);

  const { data, error } = await supabase
    .from("projects")
    .insert({
      title,
      status,
      area_m2: area,
      programme_start: optionalText(formData.get("programme_start")),
      programme_end: optionalText(formData.get("programme_end")),
      scope_summary: optionalText(formData.get("scope_summary")),
      next_action: nextAction,
      next_action_due: optionalText(formData.get("next_action_due")),
    })
    .select("id, reference")
    .single();

  if (error || !data) {
    const message = encodeURIComponent(
      error?.message || "Could not create the project"
    );
    redirect(`/jobs/new?error=${message}`);
  }

  revalidatePath("/jobs");
  redirect(`/jobs/${data.id}`);
}
