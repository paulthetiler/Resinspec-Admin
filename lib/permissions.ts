export type Role =
  | "owner"
  | "office"
  | "commercial"
  | "supervisor"
  | "installer";

export type Permission =
  | "dashboard:view"
  | "pipeline:view"
  | "pipeline:edit"
  | "jobs:view_all"
  | "jobs:view_assigned"
  | "jobs:edit"
  | "survey:view"
  | "survey:edit"
  | "quote:view"
  | "quote:edit"
  | "technical:view"
  | "technical:edit"
  | "documents:view"
  | "documents:edit"
  | "qa:view"
  | "qa:complete"
  | "people:view"
  | "people:manage"
  | "commercial:view"
  | "commercial:edit"
  | "financials:view"
  | "expenses:submit"
  | "expenses:review"
  | "issues:submit"
  | "issues:review"
  | "invoices:submit"
  | "invoices:review"
  | "settings:manage";

export const rolePermissions: Record<Role, Permission[]> = {
  owner: [
    "dashboard:view",
    "pipeline:view",
    "pipeline:edit",
    "jobs:view_all",
    "jobs:view_assigned",
    "jobs:edit",
    "survey:view",
    "survey:edit",
    "quote:view",
    "quote:edit",
    "technical:view",
    "technical:edit",
    "documents:view",
    "documents:edit",
    "qa:view",
    "qa:complete",
    "people:view",
    "people:manage",
    "commercial:view",
    "commercial:edit",
    "financials:view",
    "expenses:submit",
    "expenses:review",
    "issues:submit",
    "issues:review",
    "invoices:submit",
    "invoices:review",
    "settings:manage",
  ],
  office: [
    "dashboard:view",
    "pipeline:view",
    "pipeline:edit",
    "jobs:view_all",
    "jobs:edit",
    "survey:view",
    "survey:edit",
    "quote:view",
    "quote:edit",
    "technical:view",
    "documents:view",
    "documents:edit",
    "qa:view",
    "people:view",
    "expenses:review",
    "issues:review",
    "invoices:review",
  ],
  commercial: [
    "dashboard:view",
    "pipeline:view",
    "pipeline:edit",
    "jobs:view_all",
    "jobs:edit",
    "survey:view",
    "survey:edit",
    "quote:view",
    "quote:edit",
    "technical:view",
    "documents:view",
    "qa:view",
    "people:view",
    "commercial:view",
    "commercial:edit",
    "financials:view",
    "expenses:review",
    "issues:review",
  ],
  supervisor: [
    "dashboard:view",
    "jobs:view_assigned",
    "survey:view",
    "survey:edit",
    "technical:view",
    "documents:view",
    "documents:edit",
    "qa:view",
    "qa:complete",
    "people:view",
    "expenses:submit",
    "issues:submit",
    "issues:review",
  ],
  installer: [
    "jobs:view_assigned",
    "survey:view",
    "technical:view",
    "documents:view",
    "qa:view",
    "qa:complete",
    "expenses:submit",
    "issues:submit",
    "invoices:submit",
  ],
};

export function can(role: Role, permission: Permission) {
  return rolePermissions[role].includes(permission);
}
