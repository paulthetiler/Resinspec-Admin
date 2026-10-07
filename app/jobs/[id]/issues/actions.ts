"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

function val(v: FormDataEntryValue | null) { return String(v ?? "").trim(); }
function safeName(name: string) { return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120); }

export async function submitSiteIssue(formData: FormData) {
  const { supabase } = await requireAnyPermission(["issues:submit"]);
  const projectId = val(formData.get("project_id"));
  const category = val(formData.get("category"));
  const detail = val(formData.get("detail"));
  const photo = formData.get("photo");
  if (!projectId || !category || !detail) redirect(`/jobs/${projectId || ""}/issues?error=Category%20and%20detail%20are%20required`);

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  let photoPath: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    photoPath = `${projectId}/${userId}/${Date.now()}-${safeName(photo.name || "issue.jpg")}`;
    const upload = await supabase.storage.from("site-issues").upload(photoPath, photo, { contentType: photo.type || "image/jpeg", upsert:false });
    if (upload.error) redirect(`/jobs/${projectId}/issues?error=${encodeURIComponent(upload.error.message)}`);
  }

  const { error } = await supabase.from("site_issues").insert({ project_id:projectId, raised_by:userId, category, detail, photo_path:photoPath });
  if (error) {
    if (photoPath) await supabase.storage.from("site-issues").remove([photoPath]);
    redirect(`/jobs/${projectId}/issues?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/jobs/${projectId}`);
  revalidatePath(`/jobs/${projectId}/issues`);
  redirect(`/jobs/${projectId}/issues?saved=1`);
}

export async function resolveSiteIssue(formData: FormData) {
  const { supabase } = await requireAnyPermission(["issues:review"]);
  const projectId=val(formData.get("project_id")), issueId=val(formData.get("issue_id")), note=val(formData.get("resolution_note")) || null;
  if (!projectId || !issueId) redirect("/jobs");
  const { data:claims }=await supabase.auth.getClaims();
  const now=new Date().toISOString();
  const { error }=await supabase.from("site_issues").update({status:"resolved",resolved_by:claims?.claims?.sub ?? null,resolved_at:now,resolution_note:note,updated_at:now}).eq("id",issueId).eq("project_id",projectId);
  if (error) redirect(`/jobs/${projectId}/issues?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/jobs/${projectId}/issues`);
  redirect(`/jobs/${projectId}/issues`);
}
