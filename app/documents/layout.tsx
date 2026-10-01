import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { requireAnyPermission } from "@/lib/access";

export default async function DocumentsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { role } = await requireAnyPermission(["documents:view"]);

  return (
    <AdminShell activeSlug="documents" role={role}>
      {children}
    </AdminShell>
  );
}
