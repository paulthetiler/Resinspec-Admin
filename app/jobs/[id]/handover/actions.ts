"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function refresh(projectId: string) {
  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/handover`);
  revalidatePath("/documents");
}

export async function addSnag(formData: FormData) {
  const { supabase } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();

  if (!projectId || !title) redirect("/jobs");

  const { error } = await supabase.from("snags").insert({
    project_id: projectId,
    title,
    detail: optionalText(formData.get("detail")),
    priority: String(formData.get("priority") ?? "normal"),
    due_on: optionalText(formData.get("due_on")),
    owner_person_id: optionalText(formData.get("owner_person_id")),
  });

  if (error) {
    redirect(
      `/jobs/${projectId}/handover?error=${encodeURIComponent(error.message)}`
    );
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/handover`);
}

export async function completeSnag(formData: FormData) {
  const { supabase } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");
  const snagId = String(formData.get("snag_id") ?? "");

  if (!projectId || !snagId) redirect("/jobs");

  const { error } = await supabase
    .from("snags")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", snagId)
    .eq("project_id", projectId);

  if (error) {
    redirect(
      `/jobs/${projectId}/handover?error=${encodeURIComponent(error.message)}`
    );
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/handover`);
}

export async function acceptSnag(formData: FormData) {
  const { supabase, role } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");
  const snagId = String(formData.get("snag_id") ?? "");

  if (!projectId || !snagId) redirect("/jobs");

  if (!["owner", "office", "commercial", "supervisor"].includes(role)) {
    redirect(
      `/jobs/${projectId}/handover?error=Supervisor%20or%20management%20acceptance%20required`
    );
  }

  const { data: claimsData } = await supabase.auth.getClaims();

  const { error } = await supabase
    .from("snags")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: claimsData?.claims?.sub ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", snagId)
    .eq("project_id", projectId);

  if (error) {
    redirect(
      `/jobs/${projectId}/handover?error=${encodeURIComponent(error.message)}`
    );
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/handover`);
}

export async function saveHandover(formData: FormData) {
  const { supabase, role } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");

  if (!projectId) redirect("/jobs");

  if (!["owner", "office", "commercial", "supervisor"].includes(role)) {
    redirect(
      `/jobs/${projectId}/handover?error=Management%20or%20supervisor%20access%20required`
    );
  }

  const status = String(formData.get("status") ?? "draft");
  const now = new Date().toISOString();

  const payload = {
    project_id: projectId,
    status,
    completion_date: optionalText(formData.get("completion_date")),
    client_contact_name: optionalText(formData.get("client_contact_name")),
    care_information: optionalText(formData.get("care_information")),
    warranty_information: optionalText(formData.get("warranty_information")),
    outstanding_items: optionalText(formData.get("outstanding_items")),
    issued_at: ["issued", "accepted"].includes(status) ? now : null,
    accepted_at: status === "accepted" ? now : null,
    accepted_by_name:
      status === "accepted"
        ? optionalText(formData.get("accepted_by_name"))
        : null,
    updated_at: now,
  };

  const { error } = await supabase
    .from("handover_records")
    .upsert(payload, { onConflict: "project_id" });

  if (error) {
    redirect(
      `/jobs/${projectId}/handover?error=${encodeURIComponent(error.message)}`
    );
  }

  if (status === "accepted") {
    await supabase
      .from("projects")
      .update({
        status: "handover",
        updated_at: now,
      })
      .eq("id", projectId)
      .in("status", ["prestart", "live", "handover"]);
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/handover?saved=1`);
}
