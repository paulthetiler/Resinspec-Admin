"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function saveSurvey(formData: FormData) {
  const { supabase } = await requireAnyPermission(["survey:edit"]);
  const projectId = String(formData.get("project_id") ?? "");

  if (!projectId) redirect("/jobs");

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
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("surveys")
    .upsert(payload, { onConflict: "project_id" });

  if (error) {
    redirect(
      `/jobs/${projectId}/survey?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/pipeline");
  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/survey`);
  redirect(`/jobs/${projectId}/survey?saved=1`);
}
