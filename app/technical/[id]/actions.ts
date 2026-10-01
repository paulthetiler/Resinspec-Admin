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

function values(formData: FormData) {
  return {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    name: String(formData.get("name") ?? "").trim(),
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
    updated_at: new Date().toISOString(),
  };
}

function refresh(id?: string) {
  revalidatePath("/technical");
  revalidatePath("/jobs");
  if (id) revalidatePath("/technical/" + id);
}

export async function updateTechnicalSystem(formData: FormData) {
  const { supabase } = await requireAnyPermission(["technical:edit"]);
  const id = String(formData.get("system_id") ?? "");

  if (!id) redirect("/technical");

  const { data: current } = await supabase
    .from("technical_systems")
    .select("status")
    .eq("id", id)
    .single();

  if (!current || current.status !== "draft") {
    redirect("/technical/" + id + "?error=Only%20draft%20revisions%20can%20be%20edited");
  }

  const payload = values(formData);

  if (!payload.code || !payload.name) {
    redirect("/technical/" + id + "?error=System%20code%20and%20name%20are%20required");
  }

  const { error } = await supabase
    .from("technical_systems")
    .update(payload)
    .eq("id", id)
    .eq("status", "draft");

  if (error) {
    redirect("/technical/" + id + "?error=" + encodeURIComponent(error.message));
  }

  refresh(id);
  redirect("/technical/" + id + "?saved=1");
}

export async function approveTechnicalSystem(formData: FormData) {
  const { supabase } = await requireAnyPermission(["technical:edit"]);
  const id = String(formData.get("system_id") ?? "");

  if (!id) redirect("/technical");

  const { error } = await supabase.rpc("approve_technical_system", {
    target_system_id: id,
  });

  if (error) {
    redirect("/technical/" + id + "?error=" + encodeURIComponent(error.message));
  }

  refresh(id);
  redirect("/technical/" + id + "?approved=1");
}

export async function retireTechnicalSystem(formData: FormData) {
  const { supabase } = await requireAnyPermission(["technical:edit"]);
  const id = String(formData.get("system_id") ?? "");

  if (!id) redirect("/technical");

  const { error } = await supabase
    .from("technical_systems")
    .update({
      status: "retired",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "approved");

  if (error) {
    redirect("/technical/" + id + "?error=" + encodeURIComponent(error.message));
  }

  refresh(id);
  redirect("/technical/" + id);
}

export async function createTechnicalRevision(formData: FormData) {
  const { supabase } = await requireAnyPermission(["technical:edit"]);
  const id = String(formData.get("system_id") ?? "");

  if (!id) redirect("/technical");

  const { data: current } = await supabase
    .from("technical_systems")
    .select("*")
    .eq("id", id)
    .single();

  if (!current) redirect("/technical");

  const { data: latest } = await supabase
    .from("technical_systems")
    .select("revision")
    .ilike("code", current.code)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: next, error } = await supabase
    .from("technical_systems")
    .insert({
      code: current.code,
      name: current.name,
      manufacturer: current.manufacturer,
      category: current.category,
      nominal_thickness_mm: current.nominal_thickness_mm,
      slip_rating: current.slip_rating,
      substrate_requirements: current.substrate_requirements,
      thickness: current.thickness,
      primer: current.primer,
      body_coat: current.body_coat,
      broadcast: current.broadcast,
      topcoat: current.topcoat,
      mixing_instructions: current.mixing_instructions,
      coverage_notes: current.coverage_notes,
      pot_life_notes: current.pot_life_notes,
      cure_notes: current.cure_notes,
      application_limits: current.application_limits,
      temperature_notes: current.temperature_notes,
      chemical_notes: current.chemical_notes,
      tds_reference: current.tds_reference,
      sds_reference: current.sds_reference,
      revision: (latest?.revision ?? current.revision) + 1,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !next) {
    redirect(
      "/technical/" +
        id +
        "?error=" +
        encodeURIComponent(error?.message || "Could not create revision")
    );
  }

  refresh(next.id);
  redirect("/technical/" + next.id);
}
