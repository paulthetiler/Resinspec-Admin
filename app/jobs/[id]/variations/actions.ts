"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

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
  revalidatePath("/commercial");
  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/commercial`);
  revalidatePath(`/jobs/${projectId}/variations`);
}

export async function addVariation(formData: FormData) {
  const { supabase } = await requireAnyPermission(["commercial:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");

  if (!projectId || !reference || !title) redirect("/commercial");

  const { error } = await supabase.from("variations").insert({
    project_id: projectId,
    reference,
    title,
    description: optionalText(formData.get("description")),
    status,
    submitted_value: optionalNumber(formData.get("submitted_value")),
    estimated_cost_impact: optionalNumber(formData.get("estimated_cost_impact")),
    programme_impact_days: optionalNumber(formData.get("programme_impact_days")),
    client_reference: optionalText(formData.get("client_reference")),
    submitted_at: status === "submitted" ? new Date().toISOString() : null,
  });

  if (error) {
    redirect(
      `/jobs/${projectId}/variations?error=${encodeURIComponent(error.message)}`
    );
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/variations`);
}

export async function decideVariation(formData: FormData) {
  const { supabase } = await requireAnyPermission(["commercial:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const variationId = String(formData.get("variation_id") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (!projectId || !variationId || !["approved", "rejected", "withdrawn"].includes(decision)) {
    redirect("/commercial");
  }

  const { data: variation } = await supabase
    .from("variations")
    .select("submitted_value")
    .eq("id", variationId)
    .eq("project_id", projectId)
    .single();

  const approvedValue =
    decision === "approved"
      ? optionalNumber(formData.get("approved_value")) ??
        Number(variation?.submitted_value ?? 0)
      : null;

  const { error } = await supabase
    .from("variations")
    .update({
      status: decision,
      approved_value: approvedValue,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", variationId)
    .eq("project_id", projectId);

  if (error) {
    redirect(
      `/jobs/${projectId}/variations?error=${encodeURIComponent(error.message)}`
    );
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/variations`);
}
