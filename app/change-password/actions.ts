"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function changePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 12) {
    redirect("/change-password?error=Use%20at%20least%2012%20characters");
  }

  if (password !== confirm) {
    redirect("/change-password?error=Passwords%20do%20not%20match");
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims) {
    redirect("/login");
  }

  const { error } = await supabase.auth.updateUser({
    password,
    data: {
      must_change_password: false,
    },
  });

  if (error) {
    redirect(
      `/change-password?error=${encodeURIComponent(error.message)}`
    );
  }

  await supabase.auth.refreshSession();
  redirect("/");
}
