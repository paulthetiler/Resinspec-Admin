import type { SupabaseClient } from "@supabase/supabase-js";

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

type PrestartSnapshot = {
  survey_id: string | null;
  survey_updated_at: string | null;
  system_id: string | null;
  rams_id: string | null;
  site_id: string | null;
  site_updated_at: string | null;
  programme_start: string | null;
  programme_end: string | null;
  area_m2: number | string | null;
  scope_summary: string | null;
  crew_count: number;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function sameNumber(
  left: number | string | null | undefined,
  right: number | string | null | undefined
) {
  if (left === null || left === undefined || right === null || right === undefined) {
    return left == null && right == null;
  }
  return Number(left) === Number(right);
}

export async function getPrestartState(
  supabase: SupabaseClient,
  projectId: string
) {
  const [
    { data: project, error: projectError },
    { data: survey, error: surveyError },
    { data: ramsRows, error: ramsError },
    { count: crewCount, error: crewError },
    { data: release, error: releaseError },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, reference, title, status, client_id, site_id, area_m2, programme_start, programme_end, scope_summary, system_id, sites(id, address_line_1, postcode, updated_at), technical_systems(id, code, name, status, revision)"
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
      .select("id, version, status, approved_at")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1),
    supabase
      .from("project_assignments")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("prestart_releases")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);

  if (projectError) throw projectError;
  if (surveyError) throw surveyError;
  if (ramsError) throw ramsError;
  if (crewError) throw crewError;
  if (releaseError) throw releaseError;
  if (!project) return null;

  const site = firstRelation(project.sites);
  const system = firstRelation(project.technical_systems);
  const latestRams = ramsRows?.[0] ?? null;
  const assignedCrew = crewCount ?? 0;

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

  const snapshot: PrestartSnapshot = {
    survey_id: survey?.id ?? null,
    survey_updated_at: survey?.updated_at ?? null,
    system_id: project.system_id ?? null,
    rams_id: latestRams?.id ?? null,
    site_id: project.site_id ?? null,
    site_updated_at: site?.updated_at ?? null,
    programme_start: project.programme_start ?? null,
    programme_end: project.programme_end ?? null,
    area_m2: project.area_m2 ?? null,
    scope_summary: project.scope_summary ?? null,
    crew_count: assignedCrew,
  };

  const releaseCurrent = Boolean(
    release &&
      release.status === "released" &&
      release.survey_id === snapshot.survey_id &&
      release.survey_updated_at === snapshot.survey_updated_at &&
      release.system_id === snapshot.system_id &&
      release.rams_id === snapshot.rams_id &&
      release.site_id === snapshot.site_id &&
      release.site_updated_at === snapshot.site_updated_at &&
      release.programme_start === snapshot.programme_start &&
      release.programme_end === snapshot.programme_end &&
      sameNumber(release.area_m2, snapshot.area_m2) &&
      (release.scope_summary ?? null) === snapshot.scope_summary &&
      Number(release.crew_count) === snapshot.crew_count
  );

  return {
    project,
    site,
    survey,
    system,
    latestRams,
    release,
    crewCount: assignedCrew,
    checks,
    allPass: checks.every((check) => check.pass),
    snapshot,
    releaseCurrent,
    releaseStale: Boolean(release?.status === "released" && !releaseCurrent),
  };
}
