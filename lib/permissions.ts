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
    "technical:view",
    "documents:view",
    "documents:edit",
    "qa:view",
    "qa:complete",
    "people:view",
  ],
  installer: [
    "jobs:view_assigned",
    "technical:view",
    "documents:view",
    "qa:view",
    "qa:complete",
  ],
};

export function can(role: Role, permission: Permission) {
  return rolePermissions[role].includes(permission);
}
