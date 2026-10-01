"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function saveCommercial(formData: FormData) {
  const { supabase } = await requireAnyPermission(["commercial:edit"]);
  const projectId = String(formData.get("project_id") ?? "");

  if (!projectId) redirect("/commercial");

  const estimatedDirectCost =
    optionalNumber(formData.get("estimated_direct_cost")) ?? 0;
  const contingencyPct =
    optionalNumber(formData.get("contingency_pct")) ?? 5;
  const riskAdjustedCost =
    estimatedDirectCost * (1 + contingencyPct / 100);

  const payload = {
    project_id: projectId,
    order_value: optionalNumber(formData.get("order_value")),
    estimated_direct_cost: estimatedDirectCost || null,
    contingency_pct: contingencyPct,
    risk_adjusted_cost: riskAdjustedCost || null,
    target_margin_pct: optionalNumber(formData.get("target_margin_pct")),
    actual_direct_cost: optionalNumber(formData.get("actual_direct_cost")),
    variation_value: optionalNumber(formData.get("variation_value")) ?? 0,
    invoiced_value: optionalNumber(formData.get("invoiced_value")) ?? 0,
    paid_value: optionalNumber(formData.get("paid_value")) ?? 0,
    retention_value: optionalNumber(formData.get("retention_value")) ?? 0,
    payment_terms_days: optionalNumber(formData.get("payment_terms_days")),
    due_date: optionalText(formData.get("due_date")),
    paid_date: optionalText(formData.get("paid_date")),
    notes: optionalText(formData.get("notes")),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("project_commercials")
    .upsert(payload, { onConflict: "project_id" });

  if (error) {
    redirect(
      `/jobs/${projectId}/commercial?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/commercial");
  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/commercial`);
  redirect(`/jobs/${projectId}/commercial?saved=1`);
}
