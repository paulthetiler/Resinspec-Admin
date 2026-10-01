"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { can } from "@/lib/permissions";

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

export async function createPerson(formData: FormData) {
  const { supabase, role } = await requireAnyPermission(["people:manage"]);

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) {
    redirect("/people/new?error=Name%20is%20required");
  }

  const { data: person, error } = await supabase
    .from("people")
    .insert({
      full_name: fullName,
      email: optionalText(formData.get("email")),
      phone: optionalText(formData.get("phone")),
      engagement_type: String(formData.get("engagement_type") ?? "subcontractor"),
      primary_role: optionalText(formData.get("primary_role")),
      cscs_expiry: optionalText(formData.get("cscs_expiry")),
      insurance_expiry: optionalText(formData.get("insurance_expiry")),
      training_notes: optionalText(formData.get("training_notes")),
      operational_notes: optionalText(formData.get("operational_notes")),
    })
    .select("id")
    .single();

  if (error || !person) {
    redirect(
      `/people/new?error=${encodeURIComponent(
        error?.message || "Could not add person"
      )}`
    );
  }

  if (can(role, "financials:view")) {
    const dayRate = optionalNumber(formData.get("day_rate"));
    const hourlyRate = optionalNumber(formData.get("hourly_rate"));
    const away = optionalNumber(formData.get("working_away_allowance"));

    if (dayRate !== null || hourlyRate !== null || away !== null) {
      await supabase.from("people_commercials").insert({
        person_id: person.id,
        day_rate: dayRate,
        hourly_rate: hourlyRate,
        working_away_allowance: away,
      });
    }
  }

  revalidatePath("/people");
  redirect(`/people/${person.id}`);
}
