"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

const standardHoldPoints = [
  "Substrate accepted",
  "Moisture and environment within limits",
  "Preparation complete",
  "Repairs and movement joints addressed",
  "Primer / first application accepted",
  "Batch and coverage control complete",
  "Final finish inspection",
  "Snags closed and handover ready",
];

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function refresh(projectId: string) {
  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/qa`);
}

export async function seedStandardQa(formData: FormData) {
  const { supabase } = await requireAnyPermission(["qa:complete", "jobs:edit"]);
  const projectId = String(formData.get("project_id") ?? "");

  if (!projectId) redirect("/jobs");

  const { data: existing } = await supabase
    .from("qa_records")
    .select("hold_point")
    .eq("project_id", projectId);

  const existingNames = new Set((existing || []).map((row) => row.hold_point));
  const rows = standardHoldPoints
    .filter((holdPoint) => !existingNames.has(holdPoint))
    .map((holdPoint) => ({
      project_id: projectId,
      hold_point: holdPoint,
      status: "open",
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("qa_records").insert(rows);
    if (error) {
      redirect(
        `/jobs/${projectId}/qa?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/qa`);
}

export async function completeQaRecord(formData: FormData) {
  const { supabase } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");
  const recordId = String(formData.get("record_id") ?? "");

  if (!projectId || !recordId) redirect("/jobs");

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;

  const { error } = await supabase
    .from("qa_records")
    .update({
      status: "complete",
      notes: optionalText(formData.get("notes")),
      completed_by: userId,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", recordId)
    .eq("project_id", projectId);

  if (error) {
    redirect(
      `/jobs/${projectId}/qa?error=${encodeURIComponent(error.message)}`
    );
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/qa`);
}

export async function reviewQaRecord(formData: FormData) {
  const { supabase, role } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");
  const recordId = String(formData.get("record_id") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (!projectId || !recordId) redirect("/jobs");

  if (role !== "owner" && role !== "supervisor") {
    redirect(`/jobs/${projectId}/qa?error=Supervisor%20approval%20required`);
  }

  if (!["accepted", "rejected", "not_applicable"].includes(decision)) {
    redirect(`/jobs/${projectId}/qa?error=Invalid%20QA%20decision`);
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;

  const { error } = await supabase
    .from("qa_records")
    .update({
      status: decision,
      accepted_by: userId,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", recordId)
    .eq("project_id", projectId);

  if (error) {
    redirect(
      `/jobs/${projectId}/qa?error=${encodeURIComponent(error.message)}`
    );
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/qa`);
}

export async function addSiteReading(formData: FormData) {
  const { supabase } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");
  const readingType = String(formData.get("reading_type") ?? "");
  const value = optionalNumber(formData.get("value"));
  const unit = String(formData.get("unit") ?? "").trim();

  if (!projectId || !readingType || value === null || !unit) {
    redirect(`/jobs/${projectId}/qa?error=Reading%20type%2C%20value%20and%20unit%20are%20required`);
  }

  const { error } = await supabase.from("site_readings").insert({
    project_id: projectId,
    reading_type: readingType,
    value,
    unit,
    location: optionalText(formData.get("location")),
    notes: optionalText(formData.get("notes")),
  });

  if (error) {
    redirect(
      `/jobs/${projectId}/qa?error=${encodeURIComponent(error.message)}`
    );
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/qa`);
}

export async function addBatchLog(formData: FormData) {
  const { supabase } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");
  const product = String(formData.get("product") ?? "").trim();

  if (!projectId || !product) {
    redirect(`/jobs/${projectId}/qa?error=Product%20is%20required`);
  }

  const { data: project } = await supabase
    .from("projects")
    .select("system_id")
    .eq("id", projectId)
    .single();

  const { error } = await supabase.from("batch_logs").insert({
    project_id: projectId,
    system_id: project?.system_id ?? null,
    product,
    batch_reference: optionalText(formData.get("batch_reference")),
    quantity: optionalNumber(formData.get("quantity")),
    unit: optionalText(formData.get("unit")),
    mix_ratio: optionalText(formData.get("mix_ratio")),
    mix_duration_seconds: optionalNumber(formData.get("mix_duration_seconds")),
    coverage_area_m2: optionalNumber(formData.get("coverage_area_m2")),
    mixed_at:
      optionalText(formData.get("mixed_at")) || new Date().toISOString(),
    pot_life_deadline: optionalText(formData.get("pot_life_deadline")),
    ambient_temp: optionalNumber(formData.get("ambient_temp")),
    slab_temp: optionalNumber(formData.get("slab_temp")),
    relative_humidity: optionalNumber(formData.get("relative_humidity")),
    notes: optionalText(formData.get("notes")),
  });

  if (error) {
    redirect(
      `/jobs/${projectId}/qa?error=${encodeURIComponent(error.message)}`
    );
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/qa`);
}
