import { cache } from "react";
import { redirect } from "next/navigation";
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
  const role = validRoles.includes(data as Role) ? (data as Role) : null;

  return { supabase, role };
});

export async function requireAnyPermission(permissions: Permission[]) {
  const context = await getAccessContext();

  if (!context.role) {
    redirect("/unauthorised");
  }

  if (!permissions.some((permission) => can(context.role!, permission))) {
    redirect("/");
  }

  return { supabase: context.supabase, role: context.role! };
}
