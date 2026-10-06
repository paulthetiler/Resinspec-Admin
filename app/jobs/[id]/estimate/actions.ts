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
  revalidatePath("/pipeline");
  revalidatePath("/jobs/" + projectId);
  revalidatePath("/jobs/" + projectId + "/commercial");
  revalidatePath("/jobs/" + projectId + "/estimate");
}

function refreshEstimate(projectId: string) {
  revalidatePath("/jobs/" + projectId + "/estimate");
}

function estimateUrl(projectId: string, suffix = "") {
  return "/jobs/" + projectId + "/estimate" + suffix;
}

export async function createEstimate(formData: FormData) {
  const { supabase } = await requireAnyPermission(["commercial:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) redirect("/commercial");

  const [{ data: project }, { data: latest }] = await Promise.all([
    supabase.from("projects").select("area_m2").eq("id", projectId).single(),
    supabase
      .from("estimates")
      .select("version")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1),
  ]);

  const version = (latest?.[0]?.version ?? 0) + 1;

  const { error } = await supabase.from("estimates").insert({
    project_id: projectId,
    version,
    status: "draft",
    area_m2: project?.area_m2 ?? null,
    contingency_pct: 5,
    target_margin_pct: 30,
  });

  if (error) {
    redirect(estimateUrl(projectId, "?error=" + encodeURIComponent(error.message)));
  }

  refresh(projectId);
  redirect(estimateUrl(projectId));
}

export async function addEstimateItem(formData: FormData) {
  const { supabase } = await requireAnyPermission(["commercial:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const estimateId = String(formData.get("estimate_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const submissionKey = optionalText(formData.get("submission_key"));

  if (!projectId || !estimateId || !description) redirect("/commercial");

  const { error } = await supabase.from("estimate_items").insert({
    estimate_id: estimateId,
    submission_key: submissionKey,
    category: String(formData.get("category") ?? "other"),
    description,
    quantity: numberValue(formData.get("quantity"), 1),
    unit: optionalText(formData.get("unit")),
    unit_cost: numberValue(formData.get("unit_cost"), 0),
    notes: optionalText(formData.get("notes")),
  });

  if (error && error.code !== "23505") {
    redirect(estimateUrl(projectId, "?error=" + encodeURIComponent(error.message)));
  }

  refreshEstimate(projectId);
}

export async function deleteEstimateItem(formData: FormData) {
  const { supabase } = await requireAnyPermission(["commercial:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const estimateId = String(formData.get("estimate_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");

  if (!projectId || !estimateId || !itemId) redirect("/commercial");

  const { error } = await supabase
    .from("estimate_items")
    .delete()
    .eq("id", itemId)
    .eq("estimate_id", estimateId);

  if (error) {
    redirect(estimateUrl(projectId, "?error=" + encodeURIComponent(error.message)));
  }

  refreshEstimate(projectId);
}

export async function removeExactDuplicateEstimateItems(
  formData: FormData
) {
  const { supabase } = await requireAnyPermission(["commercial:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const estimateId = String(formData.get("estimate_id") ?? "");

  if (!projectId || !estimateId) redirect("/commercial");

  const { data: items, error: loadError } = await supabase
    .from("estimate_items")
    .select("id,category,description,quantity,unit,unit_cost,notes,created_at")
    .eq("estimate_id", estimateId)
    .order("created_at", { ascending: true });

  if (loadError) {
    redirect(
      estimateUrl(projectId, "?error=" + encodeURIComponent(loadError.message))
    );
  }

  const seen = new Set<string>();
  const duplicateIds: string[] = [];

  for (const item of items || []) {
    const key = JSON.stringify([
      item.category,
      item.description,
      Number(item.quantity),
      item.unit ?? null,
      Number(item.unit_cost),
      item.notes ?? null,
    ]);

    if (seen.has(key)) {
      duplicateIds.push(item.id);
    } else {
      seen.add(key);
    }
  }

  if (duplicateIds.length > 0) {
    const { error } = await supabase
      .from("estimate_items")
      .delete()
      .eq("estimate_id", estimateId)
      .in("id", duplicateIds);

    if (error) {
      redirect(
        estimateUrl(projectId, "?error=" + encodeURIComponent(error.message))
      );
    }
  }

  refreshEstimate(projectId);
}

export async function saveEstimateSettings(formData: FormData) {
  const { supabase } = await requireAnyPermission(["commercial:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const estimateId = String(formData.get("estimate_id") ?? "");

  if (!projectId || !estimateId) redirect("/commercial");

  const contingency = numberValue(formData.get("contingency_pct"), 5);
  const margin = numberValue(formData.get("target_margin_pct"), 30);
  const area = numberValue(formData.get("area_m2"), 0);

  if (contingency < 0 || contingency >= 100 || margin < 0 || margin >= 95) {
    redirect(estimateUrl(projectId, "?error=Check%20contingency%20and%20margin%20percentages"));
  }

  const { error } = await supabase
    .from("estimates")
    .update({
      area_m2: area || null,
      contingency_pct: contingency,
      target_margin_pct: margin,
      notes: optionalText(formData.get("notes")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimateId)
    .eq("project_id", projectId)
    .eq("status", "draft");

  if (error) {
    redirect(estimateUrl(projectId, "?error=" + encodeURIComponent(error.message)));
  }

  refresh(projectId);
  redirect(estimateUrl(projectId, "?saved=1"));
}

export async function setEstimateStatus(formData: FormData) {
  const { supabase } = await requireAnyPermission(["commercial:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const estimateId = String(formData.get("estimate_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!projectId || !estimateId || !["draft", "internal_review", "issued", "accepted"].includes(status)) {
    redirect("/commercial");
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    status,
    updated_at: now,
  };

  if (status === "issued") payload.issued_at = now;
  if (status === "accepted") {
    payload.accepted_at = now;
    payload.approved_by = claimsData?.claims?.sub ?? null;
  }

  const { error } = await supabase
    .from("estimates")
    .update(payload)
    .eq("id", estimateId)
    .eq("project_id", projectId);

  if (error) {
    redirect(estimateUrl(projectId, "?error=" + encodeURIComponent(error.message)));
  }

  refresh(projectId);
  redirect(estimateUrl(projectId));
}

export async function createEstimateRevision(formData: FormData) {
  const { supabase } = await requireAnyPermission(["commercial:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const estimateId = String(formData.get("estimate_id") ?? "");

  if (!projectId || !estimateId) redirect("/commercial");

  const [{ data: estimate }, { data: items }] = await Promise.all([
    supabase
      .from("estimates")
      .select("*")
      .eq("id", estimateId)
      .eq("project_id", projectId)
      .single(),
    supabase
      .from("estimate_items")
      .select("category,description,quantity,unit,unit_cost,notes,sort_order")
      .eq("estimate_id", estimateId)
      .order("sort_order"),
  ]);

  if (!estimate) redirect(estimateUrl(projectId));

  const { data: next, error } = await supabase
    .from("estimates")
    .insert({
      project_id: projectId,
      version: estimate.version + 1,
      status: "draft",
      area_m2: estimate.area_m2,
      contingency_pct: estimate.contingency_pct,
      target_margin_pct: estimate.target_margin_pct,
      notes: estimate.notes,
    })
    .select("id")
    .single();

  if (error || !next) {
    redirect(
      estimateUrl(
        projectId,
        "?error=" + encodeURIComponent(error?.message || "Could not create revision")
      )
    );
  }

  if (items && items.length > 0) {
    await supabase.from("estimate_items").insert(
      items.map((item) => ({
        ...item,
        estimate_id: next.id,
      }))
    );
  }

  await supabase
    .from("estimates")
    .update({ status: "superseded", updated_at: new Date().toISOString() })
    .eq("id", estimateId)
    .eq("project_id", projectId);

  refresh(projectId);
  redirect(estimateUrl(projectId));
}

export async function adoptEstimateAsBudget(formData: FormData) {
  const { supabase } = await requireAnyPermission(["commercial:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const estimateId = String(formData.get("estimate_id") ?? "");

  if (!projectId || !estimateId) redirect("/commercial");

  const { data: estimate } = await supabase
    .from("estimates")
    .select("status,direct_cost,risk_adjusted_cost,target_margin_pct,sell_price,contingency_pct")
    .eq("id", estimateId)
    .eq("project_id", projectId)
    .single();

  if (!estimate || !["issued", "accepted"].includes(estimate.status)) {
    redirect(estimateUrl(projectId, "?error=Issue%20or%20accept%20the%20estimate%20before%20adopting%20it"));
  }

  const { error } = await supabase
    .from("project_commercials")
    .upsert(
      {
        project_id: projectId,
        order_value: estimate.sell_price,
        estimated_direct_cost: estimate.direct_cost,
        contingency_pct: estimate.contingency_pct,
        risk_adjusted_cost: estimate.risk_adjusted_cost,
        target_margin_pct: estimate.target_margin_pct,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" }
    );

  if (error) {
    redirect(estimateUrl(projectId, "?error=" + encodeURIComponent(error.message)));
  }

  refresh(projectId);
  redirect(estimateUrl(projectId, "?adopted=1"));
}
