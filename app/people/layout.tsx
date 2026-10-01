import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { requireAnyPermission } from "@/lib/access";

export default async function PeopleLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { role } = await requireAnyPermission(["people:view"]);

  return (
    <AdminShell activeSlug="people" role={role}>
      {children}
    </AdminShell>
  );
}
