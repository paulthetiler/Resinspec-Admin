"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { SUBCONTRACT_AGREEMENT_TEXT, SUBCONTRACT_AGREEMENT_VERSION } from "@/lib/subcontractor-agreement";
export async function issueSubcontractorAgreement(formData:FormData){const {supabase}=await requireAnyPermission(["people:manage"]);const personId=String(formData.get("person_id")||"");if(!personId)redirect("/people");const {data:claims}=await supabase.auth.getClaims();const userId=claims?.claims?.sub;await supabase.from("subcontractor_agreements").update({status:"superseded"}).eq("person_id",personId).eq("status","sent");const {data,error}=await supabase.from("subcontractor_agreements").insert({person_id:personId,version:SUBCONTRACT_AGREEMENT_VERSION,agreement_text:SUBCONTRACT_AGREEMENT_TEXT,created_by:userId||null}).select("token").single();if(error||!data)redirect(`/people/${personId}?agreement_error=${encodeURIComponent(error?.message||"Could not create agreement")}`);revalidatePath(`/people/${personId}`);redirect(`/people/${personId}?agreement_token=${data.token}`);}
