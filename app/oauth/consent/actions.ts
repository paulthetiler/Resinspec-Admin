"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function authId(formData: FormData) {
  const value = String(formData.get("authorization_id") ?? "").trim();
  if (!value) redirect("/");
  return value;
}

export async function approveOAuth(formData: FormData) {
  const authorizationId = authId(formData);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.oauth.approveAuthorization(
    authorizationId
  );

  if (error || !data?.redirect_url) {
    redirect(
      "/oauth/consent?authorization_id=" +
        encodeURIComponent(authorizationId) +
        "&error=" +
        encodeURIComponent(error?.message ?? "Could not approve connection")
    );
  }

  redirect(data.redirect_url);
}

export async function denyOAuth(formData: FormData) {
  const authorizationId = authId(formData);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.oauth.denyAuthorization(
    authorizationId
  );

  if (error || !data?.redirect_url) {
    redirect(
      "/oauth/consent?authorization_id=" +
        encodeURIComponent(authorizationId) +
        "&error=" +
        encodeURIComponent(error?.message ?? "Could not deny connection")
    );
  }

  redirect(data.redirect_url);
}
