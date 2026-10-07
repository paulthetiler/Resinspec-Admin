"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

function textValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
}

export async function submitExpense(formData: FormData) {
  const { supabase } = await requireAnyPermission(["expenses:submit"]);
  const projectId = textValue(formData.get("project_id"));
  const category = textValue(formData.get("category")) || "evening_meal";
  const amount = Number(formData.get("amount"));
  const note = textValue(formData.get("note")) || null;
  const receipt = formData.get("receipt");

  if (!projectId || !Number.isFinite(amount) || amount <= 0 || !(receipt instanceof File) || receipt.size === 0) {
    redirect(`/jobs/${projectId || ""}/expenses?error=Receipt%20and%20valid%20amount%20are%20required`);
  }

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const path = `${projectId}/${userId}/${Date.now()}-${safeName(receipt.name || "receipt.jpg")}`;
  const upload = await supabase.storage.from("worker-receipts").upload(path, receipt, {
    contentType: receipt.type || "image/jpeg",
    upsert: false,
  });

  if (upload.error) {
    redirect(`/jobs/${projectId}/expenses?error=${encodeURIComponent(upload.error.message)}`);
  }

  const { error } = await supabase.from("worker_expenses").insert({
    project_id: projectId,
    submitted_by: userId,
    category,
    amount,
    note,
    receipt_path: path,
  });

  if (error) {
    await supabase.storage.from("worker-receipts").remove([path]);
    redirect(`/jobs/${projectId}/expenses?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/expenses`);
  redirect(`/jobs/${projectId}/expenses?saved=1`);
}

export async function reviewExpense(formData: FormData) {
  const { supabase } = await requireAnyPermission(["expenses:review"]);
  const projectId = textValue(formData.get("project_id"));
  const expenseId = textValue(formData.get("expense_id"));
  const status = textValue(formData.get("status"));
  const reviewNote = textValue(formData.get("review_note")) || null;
  if (!projectId || !expenseId || !["approved","rejected","paid"].includes(status)) redirect("/jobs");

  const { data: claims } = await supabase.auth.getClaims();
  const now = new Date().toISOString();
  const { error } = await supabase.from("worker_expenses").update({
    status,
    review_note: reviewNote,
    reviewed_by: claims?.claims?.sub ?? null,
    reviewed_at: now,
    paid_at: status === "paid" ? now : null,
    updated_at: now,
  }).eq("id", expenseId).eq("project_id", projectId);

  if (error) redirect(`/jobs/${projectId}/expenses?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/jobs/${projectId}/expenses`);
  redirect(`/jobs/${projectId}/expenses`);
}
