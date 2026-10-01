"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: FormDataEntryValue | null) {
  const next = String(value ?? "").trim();
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    redirect(
      "/login?error=Enter%20your%20email%20and%20password&next=" +
        encodeURIComponent(next)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      "/login?error=Login%20details%20not%20recognised&next=" +
        encodeURIComponent(next)
    );
  }

  redirect(next);
}
