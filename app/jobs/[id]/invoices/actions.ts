"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberValue(value: FormDataEntryValue | null, fallback = 0) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function refresh(projectId: string) {
  revalidatePath("/commercial");
  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/commercial`);
  revalidatePath(`/jobs/${projectId}/invoices`);
}

export async function addInvoice(formData: FormData) {
  const { supabase } = await requireAnyPermission(["commercial:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();

  if (!projectId || !reference) redirect("/commercial");

  const status = String(formData.get("status") ?? "draft");

  const { error } = await supabase.from("invoices").insert({
    project_id: projectId,
    reference,
    invoice_type: String(formData.get("invoice_type") ?? "invoice"),
    status,
    net_amount: numberValue(formData.get("net_amount")),
    vat_amount: numberValue(formData.get("vat_amount")),
    retention_amount: numberValue(formData.get("retention_amount")),
    paid_amount: numberValue(formData.get("paid_amount")),
    period_end: optionalText(formData.get("period_end")),
    issued_on: optionalText(formData.get("issued_on")),
    due_on: optionalText(formData.get("due_on")),
    paid_on: optionalText(formData.get("paid_on")),
    client_reference: optionalText(formData.get("client_reference")),
    notes: optionalText(formData.get("notes")),
  });

  if (error) {
    redirect(
      `/jobs/${projectId}/invoices?error=${encodeURIComponent(error.message)}`
    );
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/invoices`);
}

export async function updateInvoice(formData: FormData) {
  const { supabase } = await requireAnyPermission(["commercial:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const invoiceId = String(formData.get("invoice_id") ?? "");

  if (!projectId || !invoiceId) redirect("/commercial");

  const paidAmount = numberValue(formData.get("paid_amount"));
  const status = String(formData.get("status") ?? "submitted");

  const { error } = await supabase
    .from("invoices")
    .update({
      status,
      paid_amount: paidAmount,
      paid_on:
        status === "paid"
          ? optionalText(formData.get("paid_on")) ||
            new Date().toISOString().slice(0, 10)
          : optionalText(formData.get("paid_on")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("project_id", projectId);

  if (error) {
    redirect(
      `/jobs/${projectId}/invoices?error=${encodeURIComponent(error.message)}`
    );
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/invoices`);
}
