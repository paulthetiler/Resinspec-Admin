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
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/edit`);
}

export async function updateProject(formData: FormData) {
  const { supabase } = await requireAnyPermission(["jobs:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();

  if (!projectId || !title) redirect("/jobs");

  const { error } = await supabase
    .from("projects")
    .update({
      title,
      status: String(formData.get("status") ?? "lead"),
      area_m2: optionalNumber(formData.get("area_m2")),
      programme_start: optionalText(formData.get("programme_start")),
      programme_end: optionalText(formData.get("programme_end")),
      scope_summary: optionalText(formData.get("scope_summary")),
      next_action: optionalText(formData.get("next_action")),
      next_action_due: optionalText(formData.get("next_action_due")),
      client_id: optionalText(formData.get("client_id")),
      site_id: optionalText(formData.get("site_id")),
      system_id: optionalText(formData.get("system_id")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    redirect(
      `/jobs/${projectId}/edit?error=${encodeURIComponent(error.message)}`
    );
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}`);
}

export async function createClientForProject(formData: FormData) {
  const { supabase } = await requireAnyPermission(["jobs:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const legalName = String(formData.get("legal_name") ?? "").trim();

  if (!projectId || !legalName) {
    redirect(`/jobs/${projectId}/edit?error=Client%20name%20is%20required`);
  }

  const termsRaw = String(formData.get("payment_terms_days") ?? "").trim();
  const terms = termsRaw ? Number(termsRaw) : null;

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      legal_name: legalName,
      trading_name: optionalText(formData.get("trading_name")),
      billing_email: optionalText(formData.get("billing_email")),
      phone: optionalText(formData.get("phone")),
      payment_terms_days:
        terms !== null && Number.isFinite(terms) ? terms : null,
    })
    .select("id")
    .single();

  if (error || !client) {
    redirect(
      `/jobs/${projectId}/edit?error=${encodeURIComponent(
        error?.message || "Could not create client"
      )}`
    );
  }

  await supabase
    .from("projects")
    .update({ client_id: client.id, updated_at: new Date().toISOString() })
    .eq("id", projectId);

  refresh(projectId);
  redirect(`/jobs/${projectId}/edit?added=client`);
}

export async function createSiteForProject(formData: FormData) {
  const { supabase } = await requireAnyPermission(["jobs:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!projectId || !name) {
    redirect(`/jobs/${projectId}/edit?error=Site%20name%20is%20required`);
  }

  const { data: project } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .single();

  const { data: site, error } = await supabase
    .from("sites")
    .insert({
      client_id: project?.client_id ?? null,
      name,
      address_line_1: optionalText(formData.get("address_line_1")),
      address_line_2: optionalText(formData.get("address_line_2")),
      town_city: optionalText(formData.get("town_city")),
      postcode: optionalText(formData.get("postcode")),
      access_notes: optionalText(formData.get("access_notes")),
      induction_notes: optionalText(formData.get("induction_notes")),
      welfare_notes: optionalText(formData.get("welfare_notes")),
      power_notes: optionalText(formData.get("power_notes")),
      water_notes: optionalText(formData.get("water_notes")),
      waste_notes: optionalText(formData.get("waste_notes")),
      known_hazards: optionalText(formData.get("known_hazards")),
    })
    .select("id")
    .single();

  if (error || !site) {
    redirect(
      `/jobs/${projectId}/edit?error=${encodeURIComponent(
        error?.message || "Could not create site"
      )}`
    );
  }

  await supabase
    .from("projects")
    .update({ site_id: site.id, updated_at: new Date().toISOString() })
    .eq("id", projectId);

  refresh(projectId);
  redirect(`/jobs/${projectId}/edit?added=site`);
}
