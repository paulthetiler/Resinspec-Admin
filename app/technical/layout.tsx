import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { requireAnyPermission } from "@/lib/access";

export default async function TechnicalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { role } = await requireAnyPermission(["technical:view"]);

  return (
    <AdminShell activeSlug="technical" role={role}>
      {children}
    </AdminShell>
  );
}
