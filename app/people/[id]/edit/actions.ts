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

function personError(personId: string, message: string): never {
  redirect(
    `/people/${personId}/edit?error=${encodeURIComponent(message)}`
  );
}

export async function updatePerson(formData: FormData) {
  const { supabase, role } = await requireAnyPermission(["people:manage"]);

  const personId = String(formData.get("person_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!personId) redirect("/people");
  if (!fullName) personError(personId, "Name is required");

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("people")
    .update({
      full_name: fullName,
      email: optionalText(formData.get("email")),
      phone: optionalText(formData.get("phone")),
      engagement_type: String(
        formData.get("engagement_type") ?? "subcontractor"
      ),
      primary_role: optionalText(formData.get("primary_role")),
      active: formData.get("active") === "on",
      cscs_expiry: optionalText(formData.get("cscs_expiry")),
      insurance_expiry: optionalText(formData.get("insurance_expiry")),
      training_notes: optionalText(formData.get("training_notes")),
      operational_notes: optionalText(formData.get("operational_notes")),
      trading_name: optionalText(formData.get("trading_name")),
      utr: optionalText(formData.get("utr")),
      ni_number: optionalText(formData.get("ni_number")),
      company_number: optionalText(formData.get("company_number")),
      cis_verification_number: optionalText(formData.get("cis_verification_number")),
      cis_deduction_rate: optionalNumber(formData.get("cis_deduction_rate")),
      cis_verified_on: optionalText(formData.get("cis_verified_on")),
      status_checked_on: optionalText(formData.get("status_checked_on")),
      status_outcome: optionalText(formData.get("status_outcome")),
      contract_signed_on: optionalText(formData.get("contract_signed_on")),
      contractor_notes: optionalText(formData.get("contractor_notes")),
      updated_at: now,
    })
    .eq("id", personId);

  if (error) personError(personId, error.message);

  if (can(role, "financials:view")) {
    const { error: commercialError } = await supabase
      .from("people_commercials")
      .upsert(
        {
          person_id: personId,
          day_rate: optionalNumber(formData.get("day_rate")),
          hourly_rate: optionalNumber(formData.get("hourly_rate")),
          mileage_rate: optionalNumber(formData.get("mileage_rate")),
          working_away_allowance: optionalNumber(
            formData.get("working_away_allowance")
          ),
          commercial_notes: optionalText(formData.get("commercial_notes")),
          updated_at: now,
        },
        { onConflict: "person_id" }
      );

    if (commercialError) personError(personId, commercialError.message);
  }

  revalidatePath("/people");
  revalidatePath(`/people/${personId}`);
  revalidatePath(`/people/${personId}/edit`);

  redirect(`/people/${personId}?updated=1`);
}
