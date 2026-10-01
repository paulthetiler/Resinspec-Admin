import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { requireAnyPermission } from "@/lib/access";

export default async function EstimatorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { role } = await requireAnyPermission(["commercial:view"]);

  return (
    <AdminShell activeSlug="estimator" role={role}>
      {children}
    </AdminShell>
  );
}
