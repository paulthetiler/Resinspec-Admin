"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function refresh(projectId: string) {
  revalidatePath("/pipeline");
  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/survey`);
  revalidatePath(`/jobs/${projectId}/prestart`);
}

function surveyError(projectId: string, message: string): never {
  redirect(`/jobs/${projectId}/survey?error=${encodeURIComponent(message)}`);
}

const REQUIRED_SURVEY_FIELDS = [
  ["survey_date", "survey date"],
  ["substrate_type", "substrate type"],
  ["substrate_condition", "substrate condition"],
  ["contamination_notes", "contamination"],
  ["cracks_and_joints", "cracks / movement joints"],
  ["preparation_notes", "preparation approach"],
  ["moisture_test_method", "moisture test method"],
  ["moisture_summary", "moisture summary"],
  ["falls_and_drainage", "falls / drainage"],
  ["access_constraints", "access constraints"],
  ["power_and_water", "power / water"],
  ["programme_constraints", "programme constraints"],
  ["service_conditions", "service conditions"],
  ["slip_requirement", "slip requirement"],
  ["hygiene_requirement", "hygiene requirement"],
  ["washdown_requirement", "washdown requirement"],
  ["thermal_exposure", "thermal exposure"],
  ["chemical_exposure", "chemical exposure"],
  ["downtime_window", "downtime window"],
] as const;

export async function saveSurvey(formData: FormData) {
  const { supabase } = await requireAnyPermission(["survey:edit"]);
  const projectId = String(formData.get("project_id") ?? "");

  if (!projectId) redirect("/jobs");

  const now = new Date().toISOString();
  const payload = {
    project_id: projectId,
    survey_date: optionalText(formData.get("survey_date")),
    substrate_type: optionalText(formData.get("substrate_type")),
    substrate_condition: optionalText(formData.get("substrate_condition")),
    existing_finish: optionalText(formData.get("existing_finish")),
    contamination_notes: optionalText(formData.get("contamination_notes")),
    cracks_and_joints: optionalText(formData.get("cracks_and_joints")),
    preparation_notes: optionalText(formData.get("preparation_notes")),
    moisture_test_method: optionalText(formData.get("moisture_test_method")),
    moisture_summary: optionalText(formData.get("moisture_summary")),
    falls_and_drainage: optionalText(formData.get("falls_and_drainage")),
    access_constraints: optionalText(formData.get("access_constraints")),
    power_and_water: optionalText(formData.get("power_and_water")),
    programme_constraints: optionalText(formData.get("programme_constraints")),
    service_conditions: optionalText(formData.get("service_conditions")),
    slip_requirement: optionalText(formData.get("slip_requirement")),
    hygiene_requirement: optionalText(formData.get("hygiene_requirement")),
    washdown_requirement: optionalText(formData.get("washdown_requirement")),
    thermal_exposure: optionalText(formData.get("thermal_exposure")),
    chemical_exposure: optionalText(formData.get("chemical_exposure")),
    downtime_window: optionalText(formData.get("downtime_window")),
    client_requirements: optionalText(formData.get("client_requirements")),
    technical_outcome: String(formData.get("technical_outcome") ?? "review"),
    release_status: "draft",
    completed_by: null,
    completed_at: null,
    reviewed_by: null,
    reviewed_at: null,
    released_by: null,
    released_at: null,
    review_note: null,
    updated_at: now,
  };

  const { error } = await supabase
    .from("surveys")
    .upsert(payload, { onConflict: "project_id" });

  if (error) surveyError(projectId, error.message);

  refresh(projectId);
  redirect(`/jobs/${projectId}/survey?saved=1`);
}

export async function completeSurvey(formData: FormData) {
  const { supabase } = await requireAnyPermission(["survey:edit"]);
  const projectId = String(formData.get("project_id") ?? "");

  if (!projectId) redirect("/jobs");

  const { data: survey, error } = await supabase
    .from("surveys")
    .select("*")
    .eq("project_id", projectId)
    .single();

  if (error || !survey) {
    surveyError(projectId, error?.message || "Save the survey before completing it");
  }

  const missing = REQUIRED_SURVEY_FIELDS
    .filter(([key]) => !String(survey[key] ?? "").trim())
    .map(([, label]) => label);

  if (survey.technical_outcome === "review") {
    missing.push("technical outcome");
  }

  const { count: photoCount, error: photoError } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("survey_id", survey.id)
    .eq("document_type", "photo")
    .in("status", ["complete", "approved"]);

  if (photoError) surveyError(projectId, photoError.message);

  if ((photoCount ?? 0) < 3) {
    missing.push("at least 3 survey photos");
  }

  if (missing.length > 0) {
    surveyError(
      projectId,
      `Survey cannot be completed yet. Record: ${missing.join(", ")}. Use N/A where a condition genuinely does not apply.`
    );
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("surveys")
    .update({
      release_status: "complete",
      completed_by: claimsData?.claims?.sub ?? null,
      completed_at: now,
      reviewed_by: null,
      reviewed_at: null,
      released_by: null,
      released_at: null,
      review_note: null,
      updated_at: now,
    })
    .eq("id", survey.id)
    .eq("project_id", projectId);

  if (updateError) surveyError(projectId, updateError.message);

  refresh(projectId);
  redirect(`/jobs/${projectId}/survey?completed=1`);
}

export async function reviewSurvey(formData: FormData) {
  const { supabase, role } = await requireAnyPermission(["survey:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const reviewNote = optionalText(formData.get("review_note"));

  if (!projectId) redirect("/jobs");

  if (role !== "owner" && role !== "supervisor") {
    surveyError(projectId, "Owner or supervisor review is required");
  }

  if (!["released", "blocked"].includes(decision)) {
    surveyError(projectId, "Invalid survey review decision");
  }

  const { data: survey, error } = await supabase
    .from("surveys")
    .select("id, release_status, technical_outcome")
    .eq("project_id", projectId)
    .single();

  if (error || !survey) {
    surveyError(projectId, error?.message || "Survey not found");
  }

  if (survey.release_status !== "complete") {
    surveyError(projectId, "Complete the survey before technical review");
  }

  if (decision === "released" && survey.technical_outcome !== "suitable") {
    surveyError(
      projectId,
      "Only a survey with a Suitable technical outcome can be released for pre-start"
    );
  }

  if (decision === "blocked" && !reviewNote) {
    surveyError(projectId, "Add a review note explaining what must be resolved");
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("surveys")
    .update({
      release_status: decision,
      reviewed_by: userId,
      reviewed_at: now,
      released_by: decision === "released" ? userId : null,
      released_at: decision === "released" ? now : null,
      review_note: reviewNote,
      updated_at: now,
    })
    .eq("id", survey.id)
    .eq("project_id", projectId);

  if (updateError) surveyError(projectId, updateError.message);

  refresh(projectId);
  redirect(
    `/jobs/${projectId}/survey?${decision === "released" ? "released=1" : "blocked=1"}`
  );
}
