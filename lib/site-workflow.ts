import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/lib/permissions";
import { getPrestartState } from "@/lib/prestart";
import { QA_GATES, isQaReleased, sortQaRecords } from "@/lib/qa-gates";

export type WorkflowTone =
  | "complete"
  | "current"
  | "blocked"
  | "locked"
  | "waiting";

export type SiteWorkflowItem = {
  code:
    | "survey"
    | "system"
    | "rams"
    | "crew"
    | "prestart"
    | "qa"
    | "handover";
  label: string;
  status: string;
  detail: string;
  href: string;
  tone: WorkflowTone;
  progress?: string | null;
};

export type SiteWorkflowState = {
  phase: "prestart" | "installation" | "handover" | "complete";
  phaseLabel: string;
  nextAction: {
    eyebrow: string;
    title: string;
    detail: string;
    buttonLabel: string;
    href: string;
    blocked: boolean;
  };
  items: SiteWorkflowItem[];
  qaReleased: number;
  qaTotal: number;
};

function route(projectId: string, suffix = "") {
  return `/jobs/${projectId}${suffix}`;
}

function canManageJob(role: Role) {
  return ["owner", "office", "commercial"].includes(role);
}

function canReviewTechnical(role: Role) {
  return role === "owner" || role === "supervisor";
}

export async function getSiteWorkflowState(
  supabase: SupabaseClient,
  projectId: string,
  role: Role
): Promise<SiteWorkflowState | null> {
  const prestart = await getPrestartState(supabase, projectId);
  if (!prestart) return null;

  const [{ data: qaRows, error: qaError }, { data: handover, error: handoverError }] =
    await Promise.all([
      supabase
        .from("qa_records")
        .select("id, hold_point, status")
        .eq("project_id", projectId),
      supabase
        .from("handover_records")
        .select("status, issued_at, accepted_at")
        .eq("project_id", projectId)
        .maybeSingle(),
    ]);

  if (qaError) throw qaError;
  if (handoverError) throw handoverError;

  const sortedQa = sortQaRecords(qaRows || []);
  const qaByLabel = new Map(
    sortedQa.map((record) => [record.hold_point, record])
  );
  const qaReleased = QA_GATES.filter((gate) => {
    const record = qaByLabel.get(gate.label);
    return Boolean(record && isQaReleased(record.status));
  }).length;
  const qaTotal = QA_GATES.length;
  const currentGate = QA_GATES.find((gate) => {
    const record = qaByLabel.get(gate.label);
    return !record || !isQaReleased(record.status);
  });
  const currentQaRecord = currentGate
    ? qaByLabel.get(currentGate.label) ?? null
    : null;
  const allQaReleased = qaReleased === qaTotal;

  const surveyReleased =
    prestart.survey?.release_status === "released" &&
    prestart.survey?.technical_outcome === "suitable";
  const systemApproved = Boolean(
    prestart.project.system_id && prestart.system?.status === "approved"
  );
  const ramsApproved = prestart.latestRams?.status === "approved";
  const crewAssigned = prestart.crewCount > 0;

  const surveyStatus = surveyReleased
    ? "Released"
    : prestart.survey?.release_status === "blocked"
      ? "Blocked"
      : prestart.survey?.release_status === "complete"
        ? "Review required"
        : prestart.survey
          ? "In progress"
          : "Not started";

  const surveyTone: WorkflowTone = surveyReleased
    ? "complete"
    : prestart.survey?.release_status === "blocked"
      ? "blocked"
      : "current";

  const items: SiteWorkflowItem[] = [
    {
      code: "survey",
      label: "Survey",
      status: surveyStatus,
      detail: surveyReleased
        ? "Technical survey released."
        : prestart.survey?.release_status === "complete"
          ? canReviewTechnical(role)
            ? "Complete survey is waiting for technical release."
            : "Waiting for Owner / Supervisor technical release."
          : prestart.survey?.review_note ||
            "Record substrate, service conditions and survey evidence.",
      href: route(projectId, "/survey"),
      tone: surveyTone,
    },
    {
      code: "system",
      label: "System",
      status: systemApproved ? "Approved" : "Action required",
      detail: systemApproved
        ? `${prestart.system?.code} · Rev ${prestart.system?.revision}`
        : prestart.system
          ? `Assigned system is ${prestart.system.status}.`
          : "Approved technical system not assigned.",
      href: canManageJob(role)
        ? route(projectId, "/edit")
        : route(projectId, "/prestart"),
      tone: systemApproved ? "complete" : surveyReleased ? "current" : "locked",
    },
    {
      code: "rams",
      label: "RAMS",
      status: ramsApproved ? "Approved" : "Action required",
      detail: ramsApproved
        ? `RAMS Rev ${prestart.latestRams?.version} approved.`
        : prestart.latestRams
          ? `Latest RAMS Rev ${prestart.latestRams.version} is ${prestart.latestRams.status}.`
          : "Project RAMS not approved.",
      href: route(projectId, "/rams"),
      tone: ramsApproved
        ? "complete"
        : surveyReleased && systemApproved
          ? "current"
          : "locked",
    },
    {
      code: "crew",
      label: "Crew",
      status: crewAssigned ? "Assigned" : "Action required",
      detail: crewAssigned
        ? `${prestart.crewCount} assignment${prestart.crewCount === 1 ? "" : "s"} on the job.`
        : "No site crew assigned yet.",
      href: canManageJob(role)
        ? route(projectId, "/crew")
        : route(projectId, "/prestart"),
      tone: crewAssigned ? "complete" : ramsApproved ? "current" : "locked",
    },
    {
      code: "prestart",
      label: "Pre-start",
      status: prestart.releaseCurrent
        ? "Released"
        : prestart.releaseStale
          ? "Re-release required"
          : prestart.allPass
            ? "Ready to release"
            : "Blocked",
      detail: prestart.releaseCurrent
        ? "Start-work gate released."
        : prestart.releaseStale
          ? "A controlled job input changed after release."
          : prestart.allPass
            ? "All readiness checks pass."
            : `${prestart.checks.filter((check) => !check.pass).length} readiness check${prestart.checks.filter((check) => !check.pass).length === 1 ? "" : "s"} still blocking release.`,
      href: route(projectId, "/prestart"),
      tone: prestart.releaseCurrent
        ? "complete"
        : prestart.allPass || prestart.releaseStale
          ? "current"
          : "blocked",
    },
    {
      code: "qa",
      label: "Installation QA",
      status: allQaReleased
        ? "Complete"
        : !prestart.releaseCurrent
          ? "Locked"
          : currentGate
            ? `Gate ${currentGate.order} of ${qaTotal}`
            : "Ready",
      detail: allQaReleased
        ? "All installation gates released."
        : !prestart.releaseCurrent
          ? "Pre-start must be released first."
          : currentGate
            ? currentGate.label
            : "Set up the standard QA gates.",
      href: currentGate
        ? route(projectId, `/qa#gate-${currentGate.order}`)
        : route(projectId, "/qa"),
      tone: allQaReleased
        ? "complete"
        : prestart.releaseCurrent
          ? "current"
          : "locked",
      progress: `${qaReleased}/${qaTotal}`,
    },
    {
      code: "handover",
      label: "Handover",
      status:
        handover?.status === "accepted"
          ? "Accepted"
          : handover?.status === "issued"
            ? "Issued"
            : allQaReleased
              ? "Ready"
              : "Locked",
      detail:
        handover?.status === "accepted"
          ? "Client handover accepted."
          : handover?.status === "issued"
            ? "Issued to client; acceptance pending."
            : allQaReleased
              ? "QA complete. Finish the handover record."
              : "Unlocks when all QA gates are released.",
      href:
        handover?.status === "accepted"
          ? route(projectId, "/handover/report")
          : route(projectId, "/handover"),
      tone:
        handover?.status === "accepted"
          ? "complete"
          : allQaReleased
            ? "current"
            : "locked",
    },
  ];

  let nextAction: SiteWorkflowState["nextAction"];
  let phase: SiteWorkflowState["phase"] = "prestart";
  let phaseLabel = "Pre-start";

  if (!prestart.checks[0]?.pass) {
    nextAction = {
      eyebrow: "Job blocked",
      title: "Job is not authorised for site start",
      detail:
        "The project must be won / authorised before the site workflow can be released.",
      buttonLabel: "Open job",
      href: route(projectId),
      blocked: true,
    };
  } else if (!prestart.checks.find((check) => check.code === "site_scope")?.pass) {
    nextAction = {
      eyebrow: "Next action",
      title: "Confirm the site and job scope",
      detail:
        "Client, site address, floor area and scope need to be complete before the job can move through pre-start.",
      buttonLabel: canManageJob(role) ? "Edit job" : "View pre-start block",
      href: canManageJob(role)
        ? route(projectId, "/edit")
        : route(projectId, "/prestart"),
      blocked: !canManageJob(role),
    };
  } else if (!surveyReleased) {
    const completeAwaitingReview =
      prestart.survey?.release_status === "complete";
    nextAction = {
      eyebrow: "Next action",
      title: completeAwaitingReview
        ? canReviewTechnical(role)
          ? "Release the technical survey"
          : "Technical survey is waiting for approval"
        : prestart.survey?.release_status === "blocked"
          ? "Resolve the blocked survey"
          : "Complete the technical survey",
      detail: completeAwaitingReview
        ? canReviewTechnical(role)
          ? "Review the completed survey and release it when the technical outcome is suitable."
          : "An Owner or Supervisor needs to review and release the completed survey."
        : "Finish the substrate, service-condition and evidence record before pre-start.",
      buttonLabel: completeAwaitingReview
        ? canReviewTechnical(role)
          ? "Review survey"
          : "View survey"
        : "Continue survey",
      href: route(projectId, "/survey"),
      blocked: completeAwaitingReview && !canReviewTechnical(role),
    };
  } else if (!systemApproved) {
    nextAction = {
      eyebrow: "Next action",
      title: "Approved system required",
      detail:
        "Pre-start cannot be released until the job has an approved technical system revision.",
      buttonLabel: canManageJob(role) ? "Assign system" : "View pre-start block",
      href: canManageJob(role)
        ? route(projectId, "/edit")
        : route(projectId, "/prestart"),
      blocked: !canManageJob(role),
    };
  } else if (!ramsApproved) {
    nextAction = {
      eyebrow: "Next action",
      title: "Approve project RAMS",
      detail:
        "The latest RAMS revision must be approved before the job can be released to site.",
      buttonLabel: "Open RAMS",
      href: route(projectId, "/rams"),
      blocked: false,
    };
  } else if (!prestart.checks.find((check) => check.code === "programme")?.pass) {
    nextAction = {
      eyebrow: "Next action",
      title: "Confirm the programme",
      detail: "Record valid start and finish dates before pre-start release.",
      buttonLabel: canManageJob(role) ? "Edit job" : "View pre-start block",
      href: canManageJob(role)
        ? route(projectId, "/edit")
        : route(projectId, "/prestart"),
      blocked: !canManageJob(role),
    };
  } else if (!crewAssigned) {
    nextAction = {
      eyebrow: "Next action",
      title: "Assign the site crew",
      detail: "At least one crew member must be allocated before release.",
      buttonLabel: canManageJob(role) ? "Assign crew" : "View pre-start block",
      href: canManageJob(role)
        ? route(projectId, "/crew")
        : route(projectId, "/prestart"),
      blocked: !canManageJob(role),
    };
  } else if (!prestart.releaseCurrent) {
    nextAction = {
      eyebrow: "Next action",
      title: prestart.releaseStale
        ? "Re-release pre-start"
        : prestart.allPass
          ? "Release pre-start"
          : "Resolve pre-start blockers",
      detail: prestart.releaseStale
        ? "A controlled job input changed after the last release."
        : prestart.allPass
          ? "Everything required for site start is ready for final release."
          : "Open the pre-start screen to see the remaining blockers.",
      buttonLabel: prestart.allPass || prestart.releaseStale
        ? "Open pre-start"
        : "View blockers",
      href: route(projectId, "/prestart"),
      blocked: !prestart.allPass && !prestart.releaseStale,
    };
  } else if (!allQaReleased) {
    phase = "installation";
    phaseLabel = "Installation";

    if (!currentGate) {
      nextAction = {
        eyebrow: "Next action",
        title: "Set up installation QA",
        detail: "Create the standard eight-gate installation sequence.",
        buttonLabel: "Open QA",
        href: route(projectId, "/qa"),
        blocked: false,
      };
    } else if (!currentQaRecord) {
      nextAction = {
        eyebrow: `Installation · Gate ${currentGate.order} of ${qaTotal}`,
        title: currentGate.label,
        detail: "Set up the standard QA gates, then complete this hold point.",
        buttonLabel: "Open QA",
        href: route(projectId, `/qa#gate-${currentGate.order}`),
        blocked: false,
      };
    } else if (currentQaRecord.status === "complete") {
      const canRelease = role === "owner" || role === "supervisor";
      nextAction = {
        eyebrow: `Installation · Gate ${currentGate.order} of ${qaTotal}`,
        title: canRelease
          ? `Review: ${currentGate.label}`
          : `${currentGate.label} is awaiting release`,
        detail: canRelease
          ? "Evidence has been completed. Review it and release the next gate."
          : "The gate is complete and waiting for Owner / Supervisor approval.",
        buttonLabel: canRelease ? "Review gate" : "View QA",
        href: route(projectId, `/qa#gate-${currentGate.order}`),
        blocked: !canRelease,
      };
    } else {
      nextAction = {
        eyebrow: `Installation · Gate ${currentGate.order} of ${qaTotal}`,
        title: currentGate.label,
        detail:
          currentQaRecord.status === "rejected"
            ? "This gate was rejected. Correct the issue and resubmit the evidence."
            : currentGate.purpose,
        buttonLabel:
          currentQaRecord.status === "rejected"
            ? "Fix & resubmit gate"
            : "Open current gate",
        href: route(projectId, "/qa"),
        blocked: false,
      };
    }
  } else if (handover?.status !== "accepted") {
    phase = "handover";
    phaseLabel = "Handover";
    nextAction = {
      eyebrow: "Next action",
      title:
        handover?.status === "issued"
          ? "Complete client acceptance"
          : "Complete project handover",
      detail:
        handover?.status === "issued"
          ? "The handover has been issued and is waiting for client acceptance."
          : "All QA gates are clear. Finish the handover and issue the client record.",
      buttonLabel: "Open handover",
      href: route(projectId, "/handover"),
      blocked: false,
    };
  } else {
    phase = "complete";
    phaseLabel = "Complete";
    nextAction = {
      eyebrow: "Job complete",
      title: "Installation record closed",
      detail:
        "QA and handover are complete. The final client installation record is ready.",
      buttonLabel: "Open final QA report",
      href: route(projectId, "/handover/report"),
      blocked: false,
    };
  }

  return {
    phase,
    phaseLabel,
    nextAction,
    items,
    qaReleased,
    qaTotal,
  };
}
