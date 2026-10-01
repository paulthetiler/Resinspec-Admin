"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const OWNER_BOOTSTRAP_EMAIL = "paul@resinspec.uk";

export async function requestLoginLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect("/login?error=Enter%20your%20email%20address");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: email === OWNER_BOOTSTRAP_EMAIL,
    },
  });

  if (error) {
    redirect("/login?error=That%20account%20is%20not%20authorised");
  }

  redirect("/login?sent=1");
}
