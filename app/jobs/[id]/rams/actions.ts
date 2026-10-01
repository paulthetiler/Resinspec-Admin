"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

const standardRisks = [
  {
    hazard: "Mechanical floor preparation and rotating equipment",
    persons_at_risk: "Installers and nearby persons",
    initial_likelihood: 3,
    initial_severity: 4,
    controls:
      "Competent operators only. Guards and extraction fitted. Inspect equipment before use. Exclusion zone maintained. Isolate equipment before adjustments or disc changes. Suitable eye, hearing and respiratory protection worn.",
    residual_likelihood: 1,
    residual_severity: 4,
    sort_order: 10,
  },
  {
    hazard: "Respirable dust / silica during preparation",
    persons_at_risk: "Installers and nearby persons",
    initial_likelihood: 4,
    initial_severity: 5,
    controls:
      "Use on-tool dust extraction and suitable M-class/H-class extraction as specified. Avoid uncontrolled dry sweeping. Segregate work area. Use suitable RPE where the assessment requires it and ensure face-fit requirements are met.",
    residual_likelihood: 1,
    residual_severity: 5,
    sort_order: 20,
  },
  {
    hazard: "Resin, hardener, primer and cleaning chemicals",
    persons_at_risk: "Installers and nearby persons",
    initial_likelihood: 3,
    initial_severity: 4,
    controls:
      "Use only approved products with current SDS/COSHH information. Wear specified gloves, eye protection and clothing. Maintain ventilation. Prevent skin contact and uncontrolled mixing. Follow manufacturer first-aid, spill and disposal instructions.",
    residual_likelihood: 1,
    residual_severity: 4,
    sort_order: 30,
  },
  {
    hazard: "Manual handling of materials and equipment",
    persons_at_risk: "Installers",
    initial_likelihood: 3,
    initial_severity: 3,
    controls:
      "Plan deliveries and routes. Split loads where practical. Use handling aids and team lifts for awkward/heavy items. Keep routes clear and avoid twisting while carrying.",
    residual_likelihood: 1,
    residual_severity: 3,
    sort_order: 40,
  },
  {
    hazard: "Slips, trips and wet resin work areas",
    persons_at_risk: "Installers, client staff and visitors",
    initial_likelihood: 4,
    initial_severity: 3,
    controls:
      "Segregate and sign the work area. Maintain clean access routes. Manage cables and hoses. Clean spills immediately using the specified method. Prevent access to uncured material.",
    residual_likelihood: 1,
    residual_severity: 3,
    sort_order: 50,
  },
  {
    hazard: "Electrical equipment and temporary power",
    persons_at_risk: "Installers",
    initial_likelihood: 2,
    initial_severity: 5,
    controls:
      "Use suitable site supply and protection. Inspect leads and equipment before use. Keep connectors away from wet areas. Remove damaged equipment from service. Follow site electrical rules.",
    residual_likelihood: 1,
    residual_severity: 5,
    sort_order: 60,
  },
  {
    hazard: "Noise and hand-arm vibration",
    persons_at_risk: "Installers",
    initial_likelihood: 3,
    initial_severity: 4,
    controls:
      "Select lower-exposure equipment where practical. Wear hearing protection where required. Rotate tasks and control trigger time. Maintain equipment and record exposure where applicable.",
    residual_likelihood: 1,
    residual_severity: 4,
    sort_order: 70,
  },
];

const standardSteps = [
  {
    step_order: 10,
    activity: "Pre-start and segregation",
    method:
      "Confirm induction, permits, access, welfare, emergency arrangements and work-area segregation. Review approved RAMS, system specification and current manufacturer technical data with the crew.",
    hold_point: true,
  },
  {
    step_order: 20,
    activity: "Substrate acceptance",
    method:
      "Inspect the substrate and confirm the survey assumptions remain valid. Record required moisture and environmental readings. Do not proceed where readings, contamination, movement or substrate condition fall outside the approved system requirements.",
    hold_point: true,
  },
  {
    step_order: 30,
    activity: "Mechanical preparation",
    method:
      "Prepare the floor using the specified mechanical method and dust extraction. Remove weak material and contamination to the agreed standard. Detail edges, joints and obstructions safely.",
    hold_point: false,
  },
  {
    step_order: 40,
    activity: "Repairs and joints",
    method:
      "Complete approved repairs and treat cracks/joints in accordance with the project specification. Preserve required movement joints and terminations.",
    hold_point: true,
  },
  {
    step_order: 50,
    activity: "Mixing and application",
    method:
      "Use the exact approved system revision. Check component identity and batch information. Mix full kits or approved ratios using the specified sequence and duration. Record batch, mix time, coverage and environmental conditions. Maintain pot-life and wet-edge controls.",
    hold_point: true,
  },
  {
    step_order: 60,
    activity: "Finishing and cure protection",
    method:
      "Complete broadcast/topcoat/finish as specified. Protect the area from traffic, water, contamination and premature loading for the required cure period.",
    hold_point: false,
  },
  {
    step_order: 70,
    activity: "Inspection and handover",
    method:
      "Inspect finish, close snags, collect QA evidence and waste, remove controls only when safe, and complete the project handover record.",
    hold_point: true,
  },
];

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function intValue(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(String(value ?? ""));
  return Number.isInteger(parsed) ? parsed : fallback;
}

function refresh(projectId: string) {
  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/rams`);
  revalidatePath("/documents");
}

export async function createStandardRams(formData: FormData) {
  const { supabase } = await requireAnyPermission(["documents:edit"]);
  const projectId = String(formData.get("project_id") ?? "");

  if (!projectId) redirect("/jobs");

  const [{ data: project }, { data: versions }] = await Promise.all([
    supabase
      .from("projects")
      .select("title, scope_summary")
      .eq("id", projectId)
      .single(),
    supabase
      .from("rams_documents")
      .select("version")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1),
  ]);

  const version = (versions?.[0]?.version ?? 0) + 1;

  const { data: rams, error } = await supabase
    .from("rams_documents")
    .insert({
      project_id: projectId,
      title: `${project?.title || "Project"} RAMS`,
      version,
      status: "draft",
      scope_summary: project?.scope_summary ?? null,
      access_control:
        "Work area to be segregated from client staff, visitors and other trades. Maintain safe access/egress and comply with site induction, permit and traffic-management requirements.",
      ppe_requirements:
        "Minimum site PPE plus task-specific gloves, eye protection, hearing protection and RPE where required by product SDS/COSHH and dust/noise assessment.",
      emergency_arrangements:
        "Follow site emergency arrangements and induction. Keep access routes clear. Report incidents immediately. Product-specific first aid and spill controls are taken from current SDS/COSHH information.",
      environmental_controls:
        "Prevent resin, slurry, dust and washings entering drains or uncontrolled waste streams. Segregate waste and dispose of product/packaging in accordance with manufacturer and site requirements.",
      welfare_requirements:
        "Confirm suitable toilets, washing facilities, drinking water and rest arrangements before work starts.",
    })
    .select("id")
    .single();

  if (error || !rams) {
    redirect(
      `/jobs/${projectId}/rams?error=${encodeURIComponent(
        error?.message || "Could not create RAMS"
      )}`
    );
  }

  const risks = standardRisks.map((risk) => ({ ...risk, rams_id: rams.id }));
  const steps = standardSteps.map((step) => ({ ...step, rams_id: rams.id }));

  const [riskResult, stepResult] = await Promise.all([
    supabase.from("rams_risks").insert(risks),
    supabase.from("rams_steps").insert(steps),
  ]);

  if (riskResult.error || stepResult.error) {
    redirect(
      `/jobs/${projectId}/rams?error=${encodeURIComponent(
        riskResult.error?.message ||
          stepResult.error?.message ||
          "Could not seed RAMS content"
      )}`
    );
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/rams`);
}

export async function saveRamsSummary(formData: FormData) {
  const { supabase } = await requireAnyPermission(["documents:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const ramsId = String(formData.get("rams_id") ?? "");

  if (!projectId || !ramsId) redirect("/jobs");

  const { data: rams } = await supabase
    .from("rams_documents")
    .select("status")
    .eq("id", ramsId)
    .eq("project_id", projectId)
    .single();

  if (!rams || rams.status !== "draft") {
    redirect(`/jobs/${projectId}/rams?error=Approved%20RAMS%20cannot%20be%20edited`);
  }

  const { error } = await supabase
    .from("rams_documents")
    .update({
      title: String(formData.get("title") ?? "Project RAMS").trim(),
      scope_summary: optionalText(formData.get("scope_summary")),
      access_control: optionalText(formData.get("access_control")),
      ppe_requirements: optionalText(formData.get("ppe_requirements")),
      emergency_arrangements: optionalText(formData.get("emergency_arrangements")),
      environmental_controls: optionalText(formData.get("environmental_controls")),
      welfare_requirements: optionalText(formData.get("welfare_requirements")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ramsId);

  if (error) {
    redirect(`/jobs/${projectId}/rams?error=${encodeURIComponent(error.message)}`);
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/rams?saved=1`);
}

export async function addRisk(formData: FormData) {
  const { supabase } = await requireAnyPermission(["documents:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const ramsId = String(formData.get("rams_id") ?? "");
  const hazard = String(formData.get("hazard") ?? "").trim();
  const controls = String(formData.get("controls") ?? "").trim();

  if (!projectId || !ramsId || !hazard || !controls) {
    redirect(`/jobs/${projectId}/rams?error=Hazard%20and%20controls%20are%20required`);
  }

  const { error } = await supabase.from("rams_risks").insert({
    rams_id: ramsId,
    hazard,
    persons_at_risk: optionalText(formData.get("persons_at_risk")),
    initial_likelihood: intValue(formData.get("initial_likelihood"), 3),
    initial_severity: intValue(formData.get("initial_severity"), 3),
    controls,
    residual_likelihood: intValue(formData.get("residual_likelihood"), 1),
    residual_severity: intValue(formData.get("residual_severity"), 3),
    sort_order: intValue(formData.get("sort_order"), 100),
  });

  if (error) {
    redirect(`/jobs/${projectId}/rams?error=${encodeURIComponent(error.message)}`);
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/rams`);
}

export async function addMethodStep(formData: FormData) {
  const { supabase } = await requireAnyPermission(["documents:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const ramsId = String(formData.get("rams_id") ?? "");
  const activity = String(formData.get("activity") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();

  if (!projectId || !ramsId || !activity || !method) {
    redirect(`/jobs/${projectId}/rams?error=Activity%20and%20method%20are%20required`);
  }

  const { error } = await supabase.from("rams_steps").insert({
    rams_id: ramsId,
    step_order: intValue(formData.get("step_order"), 100),
    activity,
    method,
    hold_point: formData.get("hold_point") === "on",
  });

  if (error) {
    redirect(`/jobs/${projectId}/rams?error=${encodeURIComponent(error.message)}`);
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/rams`);
}

export async function approveRams(formData: FormData) {
  const { supabase, role } = await requireAnyPermission(["documents:edit"]);
  const projectId = String(formData.get("project_id") ?? "");
  const ramsId = String(formData.get("rams_id") ?? "");

  if (!projectId || !ramsId) redirect("/jobs");

  if (role !== "owner" && role !== "supervisor") {
    redirect(`/jobs/${projectId}/rams?error=Owner%20or%20supervisor%20approval%20required`);
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;

  await supabase
    .from("rams_documents")
    .update({ status: "superseded", updated_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("status", "approved")
    .neq("id", ramsId);

  const { error } = await supabase
    .from("rams_documents")
    .update({
      status: "approved",
      approved_by: userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ramsId)
    .eq("project_id", projectId)
    .eq("status", "draft");

  if (error) {
    redirect(`/jobs/${projectId}/rams?error=${encodeURIComponent(error.message)}`);
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/rams?approved=1`);
}

export async function acknowledgeRams(formData: FormData) {
  const { supabase } = await requireAnyPermission(["documents:view"]);
  const projectId = String(formData.get("project_id") ?? "");
  const ramsId = String(formData.get("rams_id") ?? "");

  if (!projectId || !ramsId) redirect("/jobs");

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const { error } = await supabase
    .from("rams_acknowledgements")
    .upsert(
      {
        rams_id: ramsId,
        user_id: userId,
        acknowledged_at: new Date().toISOString(),
      },
      { onConflict: "rams_id,user_id" }
    );

  if (error) {
    redirect(`/jobs/${projectId}/rams?error=${encodeURIComponent(error.message)}`);
  }

  refresh(projectId);
  redirect(`/jobs/${projectId}/rams?ack=1`);
}
