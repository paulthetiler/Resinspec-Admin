"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import {
  QA_GATES,
  getQaGateByLabel,
  isQaReleased,
  sortQaRecords,
} from "@/lib/qa-gates";
import { getPrestartState } from "@/lib/prestart";

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
  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/qa`);
  revalidatePath(`/jobs/${projectId}/handover`);
}

function qaError(projectId: string, message: string): never {
  redirect(`/jobs/${projectId}/qa?error=${encodeURIComponent(message)}`);
}

async function getQaRecord(
  supabase: Awaited<ReturnType<typeof requireAnyPermission>>["supabase"],
  projectId: string,
  recordId: string
) {
  const { data, error } = await supabase
    .from("qa_records")
    .select("id, hold_point, status, notes")
    .eq("id", recordId)
    .eq("project_id", projectId)
    .single();

  if (error || !data) {
    qaError(projectId, error?.message || "QA gate not found");
  }

  return data;
}

async function assertPreviousGatesReleased(
  supabase: Awaited<ReturnType<typeof requireAnyPermission>>["supabase"],
  projectId: string,
  holdPoint: string
) {
  const currentGate = getQaGateByLabel(holdPoint);
  if (!currentGate) return;

  const { data, error } = await supabase
    .from("qa_records")
    .select("hold_point, status")
    .eq("project_id", projectId);

  if (error) qaError(projectId, error.message);

  const byLabel = new Map((data || []).map((row) => [row.hold_point, row.status]));

  for (const gate of QA_GATES.filter((item) => item.order < currentGate.order)) {
    const status = byLabel.get(gate.label);
    if (!status || !isQaReleased(status)) {
      qaError(
        projectId,
        `Gate ${currentGate.order} is locked until Gate ${gate.order} — ${gate.label} — is accepted`
      );
    }
  }
}

async function assertGateEvidence(
  supabase: Awaited<ReturnType<typeof requireAnyPermission>>["supabase"],
  projectId: string,
  holdPoint: string,
  recordId: string
) {
  const gate = getQaGateByLabel(holdPoint);
  if (!gate) return;

  if (gate.photoRequired) {
    const { data: photos, error: photosError } = await supabase
      .from("documents")
      .select("id")
      .eq("project_id", projectId)
      .eq("qa_record_id", recordId)
      .eq("document_type", "photo")
      .in("status", ["complete", "approved"])
      .limit(1);

    if (photosError) qaError(projectId, photosError.message);
    if (!photos || photos.length === 0) {
      qaError(projectId, `Add at least one photo to ${gate.label} before completing the gate`);
    }
  }

  if (gate.code === "pre_application") {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("system_id")
      .eq("id", projectId)
      .single();

    if (projectError) qaError(projectId, projectError.message);
    if (!project?.system_id) {
      qaError(projectId, "Assign an approved technical system before releasing pre-application conditions");
    }

    const { data: system, error: systemError } = await supabase
      .from("technical_systems")
      .select("status, code, revision")
      .eq("id", project.system_id)
      .single();

    if (systemError) qaError(projectId, systemError.message);
    if (!system || system.status !== "approved") {
      qaError(projectId, "The assigned technical system must be approved before resin application");
    }

    const { data: readings, error: readingsError } = await supabase
      .from("site_readings")
      .select("reading_type")
      .eq("project_id", projectId);

    if (readingsError) qaError(projectId, readingsError.message);

    const recorded = new Set((readings || []).map((row) => row.reading_type));
    const required = [
      ["moisture", "moisture"],
      ["ambient_temp", "ambient temperature"],
      ["slab_temp", "slab temperature"],
      ["relative_humidity", "relative humidity"],
    ] as const;

    const missing = required
      .filter(([key]) => !recorded.has(key))
      .map(([, label]) => label);

    if (missing.length > 0) {
      qaError(
        projectId,
        `Record ${missing.join(", ")} before releasing pre-application conditions`
      );
    }
  }

  if (gate.code === "batch_control") {
    const { data, error } = await supabase
      .from("batch_logs")
      .select("id")
      .eq("project_id", projectId)
      .limit(1);

    if (error) qaError(projectId, error.message);
    if (!data || data.length === 0) {
      qaError(projectId, "Log at least one product batch / mix before completing batch and coverage control");
    }
  }

  if (gate.code === "handover_ready") {
    const { data, error } = await supabase
      .from("snags")
      .select("id, title, status")
      .eq("project_id", projectId)
      .neq("status", "accepted")
      .limit(1);

    if (error) qaError(projectId, error.message);
    if (data && data.length > 0) {
      qaError(projectId, `Close and accept all snags before handover. Still open: ${data[0].title}`);
    }
  }
}

export async function seedStandardQa(formData: FormData) {
  const { supabase } = await requireAnyPermission(["qa:complete", "jobs:edit"]);
  const projectId = String(formData.get("project_id") ?? "");

  if (!projectId) redirect("/jobs");

  const { data: existing } = await supabase
    .from("qa_records")
    .select("hold_point")
    .eq("project_id", projectId);

  const existingNames = new Set((existing || []).map((row) => row.hold_point));
  const rows = QA_GATES
    .filter((gate) => !existingNames.has(gate.label))
    .map((gate) => ({
      project_id: projectId,
      hold_point: gate.label,
      status: "open",
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("qa_records").insert(rows);
    if (error) qaError(projectId, error.message);
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/qa`);
}

export async function completeQaRecord(formData: FormData) {
  const { supabase } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");
  const recordId = String(formData.get("record_id") ?? "");

  if (!projectId || !recordId) redirect("/jobs");

  const record = await getQaRecord(supabase, projectId, recordId);
  const gate = getQaGateByLabel(record.hold_point);
  const notes = optionalText(formData.get("notes"));

  if (gate?.noteRequired && !notes) {
    qaError(projectId, `Add an evidence note before completing Gate ${gate.order}`);
  }

  await assertPreviousGatesReleased(supabase, projectId, record.hold_point);

  if (gate?.code === "substrate") {
    const prestart = await getPrestartState(supabase, projectId);

    if (!prestart?.releaseCurrent) {
      qaError(
        projectId,
        "Gate 1 is locked until the current job inputs have a valid Pre-start release"
      );
    }
  }

  await assertGateEvidence(supabase, projectId, record.hold_point, recordId);

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;

  const { error } = await supabase
    .from("qa_records")
    .update({
      status: "complete",
      notes,
      completed_by: userId,
      completed_at: new Date().toISOString(),
      accepted_by: null,
      accepted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recordId)
    .eq("project_id", projectId);

  if (error) qaError(projectId, error.message);

  refresh(projectId);
  redirect(`/jobs/${projectId}/qa`);
}

export async function reviewQaRecord(formData: FormData) {
  const { supabase, role } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");
  const recordId = String(formData.get("record_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const reviewNote = optionalText(formData.get("review_note"));

  if (!projectId || !recordId) redirect("/jobs");

  if (role !== "owner" && role !== "supervisor") {
    qaError(projectId, "Supervisor approval required");
  }

  if (!["accepted", "rejected", "not_applicable"].includes(decision)) {
    qaError(projectId, "Invalid QA decision");
  }

  const record = await getQaRecord(supabase, projectId, recordId);
  const gate = getQaGateByLabel(record.hold_point);

  await assertPreviousGatesReleased(supabase, projectId, record.hold_point);

  if (decision === "accepted") {
    if (record.status !== "complete") {
      qaError(projectId, "The gate must be completed before it can be accepted");
    }
    await assertGateEvidence(supabase, projectId, record.hold_point, recordId);
  }

  if (decision === "not_applicable") {
    if (!gate?.allowNotApplicable) {
      qaError(projectId, "This QA gate cannot be marked not applicable");
    }
  }

  if (decision === "rejected") {
    if (record.status !== "complete") {
      qaError(projectId, "Only a completed gate can be rejected");
    }
    if (!reviewNote) {
      qaError(projectId, "Add a rejection reason so the crew knows what must be corrected");
    }
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  const now = new Date().toISOString();

  const notes =
    decision === "rejected" && reviewNote
      ? [record.notes, `Rejected: ${reviewNote}`].filter(Boolean).join("\n")
      : record.notes;

  const { error } = await supabase
    .from("qa_records")
    .update({
      status: decision,
      notes,
      accepted_by: userId,
      accepted_at: now,
      updated_at: now,
    })
    .eq("id", recordId)
    .eq("project_id", projectId);

  if (error) qaError(projectId, error.message);

  refresh(projectId);
  redirect(`/jobs/${projectId}/qa`);
}

export async function addSiteReading(formData: FormData) {
  const { supabase } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");
  const readingType = String(formData.get("reading_type") ?? "");
  const value = optionalNumber(formData.get("value"));
  const unit = String(formData.get("unit") ?? "").trim();

  if (!projectId || !readingType || value === null || !unit) {
    qaError(projectId, "Reading type, value and unit are required");
  }

  const { error } = await supabase.from("site_readings").insert({
    project_id: projectId,
    reading_type: readingType,
    value,
    unit,
    location: optionalText(formData.get("location")),
    notes: optionalText(formData.get("notes")),
  });

  if (error) qaError(projectId, error.message);

  refresh(projectId);
  redirect(`/jobs/${projectId}/qa`);
}

export async function addBatchLog(formData: FormData) {
  const { supabase } = await requireAnyPermission(["qa:complete"]);
  const projectId = String(formData.get("project_id") ?? "");
  const product = String(formData.get("product") ?? "").trim();

  if (!projectId || !product) {
    qaError(projectId, "Product is required");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("system_id")
    .eq("id", projectId)
    .single();

  const { error } = await supabase.from("batch_logs").insert({
    project_id: projectId,
    system_id: project?.system_id ?? null,
    product,
    batch_reference: optionalText(formData.get("batch_reference")),
    quantity: optionalNumber(formData.get("quantity")),
    unit: optionalText(formData.get("unit")),
    mix_ratio: optionalText(formData.get("mix_ratio")),
    mix_duration_seconds: optionalNumber(formData.get("mix_duration_seconds")),
    coverage_area_m2: optionalNumber(formData.get("coverage_area_m2")),
    mixed_at:
      optionalText(formData.get("mixed_at")) || new Date().toISOString(),
    pot_life_deadline: optionalText(formData.get("pot_life_deadline")),
    ambient_temp: optionalNumber(formData.get("ambient_temp")),
    slab_temp: optionalNumber(formData.get("slab_temp")),
    relative_humidity: optionalNumber(formData.get("relative_humidity")),
    notes: optionalText(formData.get("notes")),
  });

  if (error) qaError(projectId, error.message);

  refresh(projectId);
  redirect(`/jobs/${projectId}/qa`);
}
