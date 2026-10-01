import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { requireAnyPermission } from "@/lib/access";

export default async function PipelineLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { role } = await requireAnyPermission(["pipeline:view"]);

  return (
    <AdminShell activeSlug="pipeline" role={role}>
      {children}
    </AdminShell>
  );
}
