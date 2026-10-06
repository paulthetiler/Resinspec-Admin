export type QaGateCode =
  | "substrate"
  | "preparation"
  | "repairs"
  | "pre_application"
  | "primer"
  | "batch_control"
  | "final_finish"
  | "handover_ready";

export type QaGateDefinition = {
  code: QaGateCode;
  order: number;
  label: string;
  purpose: string;
  evidence: string;
  noteRequired?: boolean;
  photoRequired?: boolean;
  allowNotApplicable?: boolean;
};

export const QA_GATES: QaGateDefinition[] = [
  {
    code: "substrate",
    order: 1,
    label: "Substrate accepted",
    purpose: "Confirm the base is suitable to move into preparation.",
    evidence:
      "Record substrate type, visible condition, contamination, cracks / joints and any concerns that need action.",
    noteRequired: true,
    photoRequired: true,
  },
  {
    code: "preparation",
    order: 2,
    label: "Preparation complete",
    purpose: "Release the prepared surface for repairs and pre-application checks.",
    evidence:
      "Confirm the specified mechanical preparation is complete, edges are detailed and the surface has been vacuumed clean.",
    noteRequired: true,
    photoRequired: true,
  },
  {
    code: "repairs",
    order: 3,
    label: "Repairs and movement joints addressed",
    purpose: "Confirm defects and movement details have been dealt with before resin application.",
    evidence:
      "Record crack / void repairs, edge repairs, movement joints, drains, gullies and any detailing completed.",
    noteRequired: true,
    allowNotApplicable: true,
  },
  {
    code: "pre_application",
    order: 4,
    label: "Pre-application conditions accepted",
    purpose: "Do not release resin application until the approved system and site conditions are confirmed.",
    evidence:
      "Requires an approved technical system plus recorded moisture, ambient temperature, slab temperature and relative humidity.",
  },
  {
    code: "primer",
    order: 5,
    label: "Primer / first application accepted",
    purpose: "Confirm the first resin stage is sound before building the remaining system.",
    evidence:
      "Record coverage, appearance, pinholes / defects, bond concerns and any corrective work before the next layer.",
    noteRequired: true,
    photoRequired: true,
    allowNotApplicable: true,
  },
  {
    code: "batch_control",
    order: 6,
    label: "Batch and coverage control complete",
    purpose: "Prove the installed material can be traced and the application remained under control.",
    evidence:
      "Requires at least one batch / mix log. Record product, batch reference where available, quantity, mix data and coverage.",
  },
  {
    code: "final_finish",
    order: 7,
    label: "Final finish inspection",
    purpose: "Inspect the completed floor before snag close-out and handover.",
    evidence:
      "Record finish uniformity, texture / slip finish, pinholes, bubbles, edges, drains, joints, damage and any snags raised.",
    noteRequired: true,
    photoRequired: true,
  },
  {
    code: "handover_ready",
    order: 8,
    label: "Snags closed and handover ready",
    purpose: "Final QA release before the handover record can be issued.",
    evidence:
      "All previous QA gates must be released and every snag must be accepted. Record any final cure / access restrictions.",
    noteRequired: true,
  },
];

export const QA_RELEASED_STATUSES = new Set(["accepted", "not_applicable"]);

export function getQaGateByLabel(label: string) {
  return QA_GATES.find((gate) => gate.label === label) ?? null;
}

export function qaGateOrder(label: string) {
  return getQaGateByLabel(label)?.order ?? Number.MAX_SAFE_INTEGER;
}

export function sortQaRecords<T extends { hold_point: string }>(rows: T[]) {
  return [...rows].sort(
    (a, b) => qaGateOrder(a.hold_point) - qaGateOrder(b.hold_point)
  );
}

export function isQaReleased(status: string) {
  return QA_RELEASED_STATUSES.has(status);
}
