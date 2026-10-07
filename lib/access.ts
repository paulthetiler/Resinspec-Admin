import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { can, type Permission, type Role } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

const validRoles: Role[] = [
  "owner",
  "office",
  "commercial",
  "supervisor",
  "installer",
  "subcontractor",
];

export const getAccessContext = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("current_app_role");
  const actualRole = validRoles.includes(data as Role) ? (data as Role) : null;
  const cookieStore = await cookies();
  const requestedPreview = cookieStore.get("resinspec_view_as")?.value as Role | undefined;
  const previewRole = actualRole === "owner" && requestedPreview && validRoles.includes(requestedPreview) && requestedPreview !== "owner" ? requestedPreview : null;
  const role = previewRole ?? actualRole;

  return { supabase, role, actualRole, previewRole };
});

export async function requireAnyPermission(permissions: Permission[]) {
  const context = await getAccessContext();

  if (!context.role) {
    redirect("/unauthorised");
  }

  if (!permissions.some((permission) => can(context.role!, permission))) {
    redirect("/");
  }

  return { supabase: context.supabase, role: context.role!, actualRole: context.actualRole, previewRole: context.previewRole };
}
