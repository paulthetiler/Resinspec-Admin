import type { Permission } from "./permissions";

export type NavItem = {
  slug: string;
  label: string;
  shortLabel: string;
  description: string;
  permission: Permission;
};

export const navigation: NavItem[] = [
  {
    slug: "",
    label: "Today",
    shortLabel: "Today",
    description: "What needs attention across the business.",
    permission: "dashboard:view",
  },
  {
    slug: "pipeline",
    label: "Pipeline",
    shortLabel: "Pipeline",
    description: "Enquiries, surveys, estimates, quotes and wins.",
    permission: "pipeline:view",
  },
  {
    slug: "jobs",
    label: "Jobs",
    shortLabel: "Jobs",
    description: "The master project record from pre-start to handover.",
    permission: "jobs:view_all",
  },
  {
    slug: "technical",
    label: "Technical",
    shortLabel: "Technical",
    description: "Approved systems, products, mixing data, TDS and SDS.",
    permission: "technical:view",
  },
  {
    slug: "documents",
    label: "Documents & QA",
    shortLabel: "Docs & QA",
    description: "RAMS, CPP, QA records, site evidence and handover packs.",
    permission: "documents:view",
  },
  {
    slug: "people",
    label: "People",
    shortLabel: "People",
    description: "Installers, subcontractors, competence and expiry dates.",
    permission: "people:view",
  },
  {
    slug: "commercial",
    label: "Commercial",
    shortLabel: "Commercial",
    description: "Estimator, costing, variations, applications and margin.",
    permission: "commercial:view",
  },
];
