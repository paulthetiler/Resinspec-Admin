"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { getPrestartState } from "@/lib/prestart";
import { canReleasePrestart, releaseBlockReason } from "@/lib/prestart-state";

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function prestartError(projectId: string, message: string): never {
  redirect(`/jobs/${projectId}/prestart?error=${encodeURIComponent(message)}`);
}

function refresh(projectId: string) {
  revalidatePath("/pipeline");
  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/prestart`);
  revalidatePath(`/jobs/${projectId}/qa`);
}

// Issues a NEW release. The database (prestart_release_guard) re-checks
// authority and readiness, computes the snapshot, supersedes the previous
// active release and moves a won job into pre-start. QA progress never blocks
// a re-release.
export async function releasePrestart(formData: FormData) {
  const { supabase, role } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");

  if (!projectId) redirect("/jobs");

  const state = await getPrestartState(supabase, projectId);
  if (!state) prestartError(projectId, "Project not found");

  if (state.releaseCurrent) {
    prestartError(projectId, "Pre-start is already released against the current job inputs");
  }

  const blocked = releaseBlockReason({
    role,
    projectStatus: state.project.status,
    failedChecks: state.checks.filter((check) => !check.pass).map((check) => check.label),
  });
  if (blocked) prestartError(projectId, blocked);

  const { error } = await supabase.from("prestart_releases").insert({
    project_id: projectId,
    status: "released",
    release_note: optionalText(formData.get("release_note")),
  });

  if (error) prestartError(projectId, error.message);

  refresh(projectId);
  redirect(`/jobs/${projectId}/prestart?released=1`);
}

// Withdraws the active release (kept in history). A new release is required
// before QA can progress again.
export async function withdrawPrestart(formData: FormData) {
  const { supabase, role } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");

  if (!projectId) redirect("/jobs");

  if (!canReleasePrestart(role)) {
    prestartError(projectId, "Owner or assigned Supervisor authority is required");
  }

  const reason = optionalText(formData.get("withdrawn_reason"));
  if (!reason) {
    prestartError(projectId, "Give a reason for withdrawing the pre-start release");
  }

  const { data, error } = await supabase
    .from("prestart_releases")
    .update({ status: "withdrawn", withdrawn_reason: reason })
    .eq("project_id", projectId)
    .eq("status", "released")
    .select("id");

  if (error) prestartError(projectId, error.message);
  if (!data || data.length === 0) {
    prestartError(projectId, "There is no active pre-start release to withdraw");
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/prestart?withdrawn=1`);
}
