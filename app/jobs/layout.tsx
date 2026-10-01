import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { requireAnyPermission } from "@/lib/access";

export default async function JobsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { role } = await requireAnyPermission([
    "jobs:view_all",
    "jobs:view_assigned",
  ]);

  return (
    <AdminShell activeSlug="jobs" role={role}>
      {children}
    </AdminShell>
  );
}
