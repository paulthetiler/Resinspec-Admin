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

export async function createTechnicalSystem(formData: FormData) {
  const { supabase } = await requireAnyPermission(["technical:edit"]);

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();

  if (!code || !name) {
    redirect("/technical/new?error=System%20code%20and%20name%20are%20required");
  }

  const { data: existing } = await supabase
    .from("technical_systems")
    .select("id")
    .ilike("code", code)
    .limit(1)
    .maybeSingle();

  if (existing) {
    redirect(
      "/technical/" +
        existing.id +
        "?error=This%20system%20code%20already%20exists.%20Create%20a%20new%20revision%20from%20the%20existing%20system."
    );
  }

  const { data, error } = await supabase
    .from("technical_systems")
    .insert({
      code,
      name,
      revision: 1,
      status: "draft",
      manufacturer: optionalText(formData.get("manufacturer")),
      category: optionalText(formData.get("category")),
      nominal_thickness_mm: optionalNumber(formData.get("nominal_thickness_mm")),
      slip_rating: optionalText(formData.get("slip_rating")),
      substrate_requirements: optionalText(formData.get("substrate_requirements")),
      thickness: optionalText(formData.get("thickness")),
      primer: optionalText(formData.get("primer")),
      body_coat: optionalText(formData.get("body_coat")),
      broadcast: optionalText(formData.get("broadcast")),
      topcoat: optionalText(formData.get("topcoat")),
      mixing_instructions: optionalText(formData.get("mixing_instructions")),
      coverage_notes: optionalText(formData.get("coverage_notes")),
      pot_life_notes: optionalText(formData.get("pot_life_notes")),
      cure_notes: optionalText(formData.get("cure_notes")),
      application_limits: optionalText(formData.get("application_limits")),
      temperature_notes: optionalText(formData.get("temperature_notes")),
      chemical_notes: optionalText(formData.get("chemical_notes")),
      tds_reference: optionalText(formData.get("tds_reference")),
      sds_reference: optionalText(formData.get("sds_reference")),
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(
      "/technical/new?error=" +
        encodeURIComponent(error?.message || "Could not create the technical system")
    );
  }

  revalidatePath("/technical");
  redirect("/technical/" + data.id);
}
