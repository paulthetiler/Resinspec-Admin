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
  ],
  installer: [
    "jobs:view_assigned",
    "survey:view",
    "technical:view",
    "documents:view",
    "qa:view",
    "qa:complete",
  ],
};

export function can(role: Role, permission: Permission) {
  return rolePermissions[role].includes(permission);
}
