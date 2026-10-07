import type { SupabaseClient } from "@supabase/supabase-js";
import {
  derivePrestartState,
  type PrestartReleaseRow,
  type PrestartSnapshot,
} from "@/lib/prestart-state";
import { QA_GATES, isQaReleased } from "@/lib/qa-gates";

export type PrestartCheckCode =
  | "authorised"
  | "site_scope"
  | "programme"
  | "survey"
  | "system"
  | "rams"
  | "crew";

export type PrestartCheck = {
  code: PrestartCheckCode;
  label: string;
  pass: boolean;
  detail: string;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function getPrestartState(
  supabase: SupabaseClient,
  projectId: string
) {
  const [
    { data: project, error: projectError },
    { data: survey, error: surveyError },
    { data: ramsRows, error: ramsError },
    { data: crewRows, error: crewError },
    { data: releaseRows, error: releaseError },
    { data: inputs, error: inputsError },
    { data: qaRows, error: qaError },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, reference, title, status, client_id, site_id, area_m2, programme_start, programme_end, scope_summary, system_id, sites(id, address_line_1, postcode, updated_at), technical_systems(id, code, name, status, revision, updated_at)"
      )
      .eq("id", projectId)
      .single(),
    supabase
      .from("surveys")
      .select(
        "id, release_status, technical_outcome, updated_at, released_at, review_note"
      )
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("rams_documents")
      .select("id, version, status, approved_at, updated_at")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1),
    supabase
      .from("project_assignments")
      .select("id, user_id, person_id, assignment_role, starts_on, ends_on")
      .eq("project_id", projectId)
      .order("id", { ascending: true }),
    supabase
      .from("prestart_releases")
      .select(
        "id, project_id, status, snapshot, release_note, released_by, released_at, superseded_at, superseded_by, withdrawn_at, withdrawn_by, withdrawn_reason"
      )
      .eq("project_id", projectId)
      .order("released_at", { ascending: false, nullsFirst: false }),
    supabase.rpc("prestart_current_inputs", { p_project_id: projectId }),
    supabase
      .from("qa_records")
      .select("hold_point, status")
      .eq("project_id", projectId),
  ]);

  if (projectError) throw projectError;
  if (surveyError) throw surveyError;
  if (ramsError) throw ramsError;
  if (crewError) throw crewError;
  if (releaseError) throw releaseError;
  if (inputsError) throw inputsError;
  if (qaError) throw qaError;
  if (!project) return null;

  const site = firstRelation(project.sites);
  const system = firstRelation(project.technical_systems);
  const latestRams = ramsRows?.[0] ?? null;
  const assignedCrew = crewRows?.length ?? 0;

  const authorisedStatuses = new Set([
    "won",
    "prestart",
    "live",
    "handover",
    "invoiced",
    "paid",
    "closed",
  ]);

  const siteScopePass = Boolean(
    project.client_id &&
      project.site_id &&
      site?.address_line_1 &&
      site?.postcode &&
      Number(project.area_m2 ?? 0) > 0 &&
      project.scope_summary?.trim()
  );

  const programmePass = Boolean(
    project.programme_start &&
      project.programme_end &&
      project.programme_end >= project.programme_start
  );

  const checks: PrestartCheck[] = [
    {
      code: "authorised",
      label: "Job authorised",
      pass: authorisedStatuses.has(project.status),
      detail: authorisedStatuses.has(project.status)
        ? `Project status is ${project.status}.`
        : "The job must be won / authorised before pre-start release.",
    },
    {
      code: "site_scope",
      label: "Site and scope confirmed",
      pass: siteScopePass,
      detail: siteScopePass
        ? "Client, site address, area and scope are recorded."
        : "Client, site address/postcode, floor area and scope must all be recorded.",
    },
    {
      code: "programme",
      label: "Programme confirmed",
      pass: programmePass,
      detail: programmePass
        ? `${project.programme_start} → ${project.programme_end}`
        : "Start and finish dates must be recorded, with finish on or after start.",
    },
    {
      code: "survey",
      label: "Technical survey released",
      pass:
        survey?.release_status === "released" &&
        survey?.technical_outcome === "suitable",
      detail:
        survey?.release_status === "released" &&
        survey?.technical_outcome === "suitable"
          ? `Released ${survey.released_at ? new Date(survey.released_at).toLocaleDateString("en-GB") : ""}.`
          : survey
            ? `Survey is ${survey.release_status}; technical outcome is ${survey.technical_outcome}.`
            : "No technical survey has been saved.",
    },
    {
      code: "system",
      label: "Approved technical system assigned",
      pass: Boolean(project.system_id && system?.status === "approved"),
      detail:
        project.system_id && system?.status === "approved"
          ? `${system.code} · Rev ${system.revision} · ${system.name}`
          : system
            ? `Assigned system is ${system.status}, not approved.`
            : "No technical system is assigned.",
    },
    {
      code: "rams",
      label: "RAMS approved",
      pass: latestRams?.status === "approved",
      detail:
        latestRams?.status === "approved"
          ? `RAMS Rev ${latestRams.version} approved.`
          : latestRams
            ? `Latest RAMS Rev ${latestRams.version} is ${latestRams.status}.`
            : "No RAMS revision exists.",
    },
    {
      code: "crew",
      label: "Crew assigned",
      pass: assignedCrew > 0,
      detail:
        assignedCrew > 0
          ? `${assignedCrew} project assignment${assignedCrew === 1 ? "" : "s"} recorded.`
          : "At least one crew member must be assigned.",
    },
  ];

  const releases = (releaseRows || []) as PrestartReleaseRow[];
  const currentInputs = (inputs || {}) as {
    snapshot?: PrestartSnapshot | null;
    blockers?: string[];
  };
  const derived = derivePrestartState({
    releases,
    currentSnapshot: currentInputs.snapshot ?? null,
    qaStatuses: (qaRows || []).map((row) => String(row.status)),
    projectStatus: project.status,
    qaComplete: QA_GATES.every((gate) =>
      (qaRows || []).some(
        (row) => row.hold_point === gate.label && isQaReleased(String(row.status))
      )
    ),
  });

  return {
    project,
    site,
    survey,
    system,
    latestRams,
    /** Active release, or the most recent one when none is active. */
    release: derived.active ?? derived.latest,
    releases,
    crewCount: assignedCrew,
    checks,
    allPass: checks.every((check) => check.pass),
    /** Readiness codes the database will refuse a release for. */
    databaseBlockers: currentInputs.blockers ?? [],
    releaseState: derived.state,
    releaseCurrent: derived.releaseCurrent,
    releaseStale: derived.releaseStale,
    changes: derived.changes,
    liveWork: derived.liveWork,
    onHold: derived.onHold,
  };
}
