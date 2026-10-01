"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function assignCrewMember(formData: FormData) {
  const { supabase } = await requireAnyPermission(["jobs:edit"]);

  const projectId = String(formData.get("project_id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  const assignmentRole = String(formData.get("assignment_role") ?? "installer");

  if (!projectId || !personId) {
    redirect("/jobs");
  }

  const { data: person } = await supabase
    .from("people")
    .select("id, user_id")
    .eq("id", personId)
    .single();

  if (!person) {
    redirect(`/jobs/${projectId}/crew?error=Person%20not%20found`);
  }

  const { data: existing } = await supabase
    .from("project_assignments")
    .select("id")
    .eq("project_id", projectId)
    .eq("person_id", personId)
    .maybeSingle();

  const payload = {
    project_id: projectId,
    person_id: personId,
    user_id: person.user_id,
    assignment_role: assignmentRole,
    starts_on: optionalText(formData.get("starts_on")),
    ends_on: optionalText(formData.get("ends_on")),
  };

  const result = existing
    ? await supabase
        .from("project_assignments")
        .update(payload)
        .eq("id", existing.id)
    : await supabase.from("project_assignments").insert(payload);

  if (result.error) {
    redirect(
      `/jobs/${projectId}/crew?error=${encodeURIComponent(result.error.message)}`
    );
  }

  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/crew`);
  redirect(`/jobs/${projectId}/crew`);
}

export async function removeCrewMember(formData: FormData) {
  const { supabase } = await requireAnyPermission(["jobs:edit"]);

  const projectId = String(formData.get("project_id") ?? "");
  const assignmentId = String(formData.get("assignment_id") ?? "");

  if (!projectId || !assignmentId) {
    redirect("/jobs");
  }

  await supabase
    .from("project_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("project_id", projectId);

  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/crew`);
  redirect(`/jobs/${projectId}/crew`);
}
