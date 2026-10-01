"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
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
  revalidatePath("/");
  revalidatePath("/pipeline");
  revalidatePath("/commercial");
  revalidatePath("/jobs/" + projectId);
  revalidatePath("/jobs/" + projectId + "/quote");
  revalidatePath("/jobs/" + projectId + "/commercial");
}

export async function createQuote(formData: FormData) {
  const { supabase, role } = await requireAnyPermission(["quote:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) redirect("/pipeline");

  const [{ data: project }, { data: latestQuotes }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "title,scope_summary,clients(legal_name,trading_name,billing_email)"
      )
      .eq("id", projectId)
      .single(),
    supabase
      .from("quotes")
      .select("version")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1),
  ]);

  if (!project) redirect("/pipeline");

  let estimateId: string | null = null;
  let netPrice = 0;

  if (can(role, "commercial:view")) {
    const { data: estimate } = await supabase
      .from("estimates")
      .select("id,sell_price,status")
      .eq("project_id", projectId)
      .neq("status", "superseded")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (estimate) {
      estimateId = estimate.id;
      netPrice = Number(estimate.sell_price ?? 0);
    }
  }

  const client = Array.isArray(project.clients)
    ? project.clients[0]
    : project.clients;

  const { error } = await supabase.from("quotes").insert({
    project_id: projectId,
    estimate_id: estimateId,
    version: (latestQuotes?.[0]?.version ?? 0) + 1,
    status: "draft",
    title: "Quotation – " + project.title,
    scope: project.scope_summary,
    net_price: netPrice,
    client_name_snapshot:
      client?.trading_name || client?.legal_name || null,
    contact_email_snapshot: client?.billing_email || null,
  });

  if (error) {
    redirect(
      "/jobs/" +
        projectId +
        "/quote?error=" +
        encodeURIComponent(error.message)
    );
  }

  refresh(projectId);
  redirect("/jobs/" + projectId + "/quote");
}

export async function saveQuote(formData: FormData) {
  const { supabase } = await requireAnyPermission(["quote:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const quoteId = String(formData.get("quote_id") ?? "");

  if (!projectId || !quoteId) redirect("/pipeline");

  const { error } = await supabase
    .from("quotes")
    .update({
      title: String(formData.get("title") ?? "Quotation").trim(),
      scope: optionalText(formData.get("scope")),
      exclusions: optionalText(formData.get("exclusions")),
      assumptions: optionalText(formData.get("assumptions")),
      net_price: numberValue(formData.get("net_price"), 0),
      vat_rate: numberValue(formData.get("vat_rate"), 0),
      valid_until: optionalText(formData.get("valid_until")),
      payment_terms: optionalText(formData.get("payment_terms")),
      programme_notes: optionalText(formData.get("programme_notes")),
      client_notes: optionalText(formData.get("client_notes")),
      client_name_snapshot: optionalText(formData.get("client_name_snapshot")),
      contact_email_snapshot: optionalText(
        formData.get("contact_email_snapshot")
      ),
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId)
    .eq("project_id", projectId)
    .eq("status", "draft");

  if (error) {
    redirect(
      "/jobs/" +
        projectId +
        "/quote?error=" +
        encodeURIComponent(error.message)
    );
  }

  refresh(projectId);
  redirect("/jobs/" + projectId + "/quote?saved=1");
}

export async function setQuoteStatus(formData: FormData) {
  const { supabase } = await requireAnyPermission(["quote:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const quoteId = String(formData.get("quote_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (
    !projectId ||
    !quoteId ||
    !["issued", "accepted", "rejected", "expired"].includes(status)
  ) {
    redirect("/pipeline");
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    status,
    updated_at: now,
  };

  if (status === "issued") {
    payload.issued_by = claimsData?.claims?.sub ?? null;
    payload.issued_at = now;
  }

  if (status === "accepted") {
    payload.accepted_at = now;
    payload.accepted_by_name = optionalText(
      formData.get("accepted_by_name")
    );
  }

  const { error } = await supabase
    .from("quotes")
    .update(payload)
    .eq("id", quoteId)
    .eq("project_id", projectId);

  if (error) {
    redirect(
      "/jobs/" +
        projectId +
        "/quote?error=" +
        encodeURIComponent(error.message)
    );
  }

  refresh(projectId);
  redirect("/jobs/" + projectId + "/quote");
}

export async function createQuoteRevision(formData: FormData) {
  const { supabase } = await requireAnyPermission(["quote:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const quoteId = String(formData.get("quote_id") ?? "");

  if (!projectId || !quoteId) redirect("/pipeline");

  const { data: current } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("project_id", projectId)
    .single();

  if (!current) redirect("/jobs/" + projectId + "/quote");

  const { error } = await supabase.from("quotes").insert({
    project_id: projectId,
    estimate_id: current.estimate_id,
    version: current.version + 1,
    status: "draft",
    title: current.title,
    scope: current.scope,
    exclusions: current.exclusions,
    assumptions: current.assumptions,
    net_price: current.net_price,
    vat_rate: current.vat_rate,
    valid_until: current.valid_until,
    payment_terms: current.payment_terms,
    programme_notes: current.programme_notes,
    client_notes: current.client_notes,
    client_name_snapshot: current.client_name_snapshot,
    contact_email_snapshot: current.contact_email_snapshot,
  });

  if (error) {
    redirect(
      "/jobs/" +
        projectId +
        "/quote?error=" +
        encodeURIComponent(error.message)
    );
  }

  await supabase
    .from("quotes")
    .update({ status: "superseded", updated_at: new Date().toISOString() })
    .eq("id", quoteId)
    .eq("project_id", projectId);

  refresh(projectId);
  redirect("/jobs/" + projectId + "/quote");
}
