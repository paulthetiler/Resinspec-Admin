"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { getPrestartState } from "@/lib/prestart";

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

export async function releasePrestart(formData: FormData) {
  const { supabase, role } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");

  if (!projectId) redirect("/jobs");

  if (role !== "owner" && role !== "supervisor") {
    prestartError(projectId, "Owner or supervisor pre-start release is required");
  }

  const state = await getPrestartState(supabase, projectId);
  if (!state) prestartError(projectId, "Project not found");

  if (!["won", "prestart"].includes(state.project.status)) {
    prestartError(
      projectId,
      "Pre-start can only be released while the project is Won or Pre-start"
    );
  }

  const failed = state.checks.filter((check) => !check.pass);
  if (failed.length > 0) {
    prestartError(
      projectId,
      `Pre-start is blocked: ${failed.map((check) => check.label).join(", ")}`
    );
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  const now = new Date().toISOString();

  const { error } = await supabase.from("prestart_releases").upsert(
    {
      project_id: projectId,
      status: "released",
      release_note: optionalText(formData.get("release_note")),
      released_by: userId,
      released_at: now,
      survey_id: state.snapshot.survey_id,
      survey_updated_at: state.snapshot.survey_updated_at,
      system_id: state.snapshot.system_id,
      system_updated_at: state.snapshot.system_updated_at,
      rams_id: state.snapshot.rams_id,
      rams_updated_at: state.snapshot.rams_updated_at,
      site_id: state.snapshot.site_id,
      site_updated_at: state.snapshot.site_updated_at,
      programme_start: state.snapshot.programme_start,
      programme_end: state.snapshot.programme_end,
      area_m2: state.snapshot.area_m2,
      scope_summary: state.snapshot.scope_summary,
      crew_count: state.snapshot.crew_count,
      crew_fingerprint: state.snapshot.crew_fingerprint,
      updated_at: now,
    },
    { onConflict: "project_id" }
  );

  if (error) prestartError(projectId, error.message);

  if (state.project.status === "won") {
    const { error: projectError } = await supabase
      .from("projects")
      .update({
        status: "prestart",
        next_action: "Prepare job / order materials",
        updated_at: now,
      })
      .eq("id", projectId)
      .eq("status", "won");

    if (projectError) prestartError(projectId, projectError.message);
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/prestart?released=1`);
}

export async function reopenPrestart(formData: FormData) {
  const { supabase, role } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");

  if (!projectId) redirect("/jobs");

  if (role !== "owner" && role !== "supervisor") {
    prestartError(projectId, "Owner or supervisor access required");
  }

  const { error } = await supabase
    .from("prestart_releases")
    .update({
      status: "draft",
      released_by: null,
      released_at: null,
      release_note: optionalText(formData.get("release_note")),
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId);

  if (error) prestartError(projectId, error.message);

  refresh(projectId);
  redirect(`/jobs/${projectId}/prestart?reopened=1`);
}
