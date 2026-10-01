import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { requireAnyPermission } from "@/lib/access";

export default async function CommercialLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { role } = await requireAnyPermission(["commercial:view"]);

  return (
    <AdminShell activeSlug="commercial" role={role}>
      {children}
    </AdminShell>
  );
}
