import { can, type Permission, type Role } from "./permissions";

export type NavItem = {
  slug: string;
  label: string;
  shortLabel: string;
  description: string;
  permissions: Permission[];
};

export const navigation: NavItem[] = [
  {
    slug: "",
    label: "Today",
    shortLabel: "Today",
    description: "What needs attention across the business.",
    permissions: ["dashboard:view"],
  },
  {
    slug: "pipeline",
    label: "Pipeline",
    shortLabel: "Pipeline",
    description: "Enquiries, surveys, estimates, quotes and wins.",
    permissions: ["pipeline:view"],
  },
  {
    slug: "jobs",
    label: "Jobs",
    shortLabel: "Jobs",
    description: "The master project record from pre-start to handover.",
    permissions: ["jobs:view_all", "jobs:view_assigned"],
  },
  {
    slug: "technical",
    label: "Technical",
    shortLabel: "Technical",
    description: "Approved systems, products, mixing data, TDS and SDS.",
    permissions: ["technical:view"],
  },
  {
    slug: "documents",
    label: "Documents & QA",
    shortLabel: "Docs & QA",
    description: "RAMS, CPP, QA records, site evidence and handover packs.",
    permissions: ["documents:view"],
  },
  {
    slug: "people",
    label: "People",
    shortLabel: "People",
    description: "Installers, subcontractors, competence and expiry dates.",
    permissions: ["people:view"],
  },
  {
    slug: "commercial",
    label: "Commercial",
    shortLabel: "Commercial",
    description: "Estimator, costing, variations, applications and margin.",
    permissions: ["commercial:view"],
  },
];

export function canAccessNav(role: Role, item: NavItem) {
  return item.permissions.some((permission) => can(role, permission));
}
