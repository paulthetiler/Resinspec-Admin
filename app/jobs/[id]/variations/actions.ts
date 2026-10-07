"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

const text=(v:FormDataEntryValue|null)=>String(v??"").trim()||null;
const num=(v:FormDataEntryValue|null)=>{const s=String(v??"").trim();if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null};
function refresh(id:string){revalidatePath(`/jobs/${id}`);revalidatePath(`/jobs/${id}/commercial`);revalidatePath(`/jobs/${id}/variations`);revalidatePath("/commercial")}
function fail(id:string,message:string):never{redirect(`/jobs/${id}/variations?error=${encodeURIComponent(message)}`)}

export async function raiseVariation(formData:FormData){
 const {supabase}=await requireAnyPermission(["variations:raise"]);
 const projectId=String(formData.get("project_id")??"");
 const title=String(formData.get("title")??"").trim();
 if(!projectId||!title)redirect("/jobs");
 const {count}=await supabase.from("variations").select("id",{count:"exact",head:true}).eq("project_id",projectId);
 const reference=`VAR-${String((count??0)+1).padStart(3,"0")}`;
 const emergency=formData.get("emergency_instruction")==="on";
 const {error}=await supabase.from("variations").insert({
  project_id:projectId,reference,title,description:text(formData.get("description")),
  reason:text(formData.get("reason")),requested_by_name:text(formData.get("requested_by_name")),
  requested_by_company:text(formData.get("requested_by_company")),work_started:formData.get("work_started")==="on",
  site_labour_days:num(formData.get("site_labour_days")),material_notes:text(formData.get("material_notes")),
  evidence_notes:text(formData.get("evidence_notes")),programme_impact_days:num(formData.get("programme_impact_days")),
  emergency_instruction:emergency,emergency_instruction_note:text(formData.get("emergency_instruction_note")),
  status:emergency?"proceed_at_risk":"site_submitted",submitted_at:new Date().toISOString()
 });
 if(error)fail(projectId,error.message);refresh(projectId);redirect(`/jobs/${projectId}/variations`);
}

export async function verifyVariation(formData:FormData){
 const {supabase}=await requireAnyPermission(["variations:verify"]);const projectId=String(formData.get("project_id")??"");const id=String(formData.get("variation_id")??"");
 const {data:claims}=await supabase.auth.getClaims();const uid=claims?.claims?.sub??null;
 const {error}=await supabase.from("variations").update({status:"technical_verified",technical_verified_by:uid,technical_verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).eq("project_id",projectId);
 if(error)fail(projectId,error.message);refresh(projectId);redirect(`/jobs/${projectId}/variations`);
}

export async function priceVariation(formData:FormData){
 const {supabase}=await requireAnyPermission(["commercial:edit"]);const projectId=String(formData.get("project_id")??"");const id=String(formData.get("variation_id")??"");
 const {error}=await supabase.from("variations").update({status:"internal_approved",submitted_value:num(formData.get("submitted_value")),estimated_cost_impact:num(formData.get("estimated_cost_impact")),programme_impact_days:num(formData.get("programme_impact_days")),updated_at:new Date().toISOString()}).eq("id",id).eq("project_id",projectId);
 if(error)fail(projectId,error.message);refresh(projectId);redirect(`/jobs/${projectId}/variations`);
}

export async function sendToClient(formData:FormData){
 const {supabase}=await requireAnyPermission(["commercial:edit"]);const projectId=String(formData.get("project_id")??"");const id=String(formData.get("variation_id")??"");
 const {data:claims}=await supabase.auth.getClaims();const uid=claims?.claims?.sub??null;
 const {error}=await supabase.from("variations").update({status:"sent_to_client",internal_approved_by:uid,internal_approved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).eq("project_id",projectId);
 if(error)fail(projectId,error.message);refresh(projectId);redirect(`/jobs/${projectId}/variations`);
}

export async function recordClientDecision(formData:FormData){
 const {supabase}=await requireAnyPermission(["commercial:edit"]);const projectId=String(formData.get("project_id")??"");const id=String(formData.get("variation_id")??"");const decision=String(formData.get("decision")??"");
 if(!["accepted","rejected","client_query"].includes(decision))fail(projectId,"Invalid client decision");
 if(decision==="accepted"&&formData.get("client_authority_confirmed")!=="on")fail(projectId,"Confirm the client signatory has authority to approve this variation");
 const {data:v}=await supabase.from("variations").select("submitted_value").eq("id",id).single();
 const {error}=await supabase.from("variations").update({
  status:decision,approved_value:decision==="accepted"?Number(v?.submitted_value??0):null,
  client_name:text(formData.get("client_name")),client_position:text(formData.get("client_position")),client_company:text(formData.get("client_company")),
  client_email:text(formData.get("client_email")),client_authority_confirmed:formData.get("client_authority_confirmed")==="on",
  client_acceptance_note:text(formData.get("client_acceptance_note")),client_accepted_at:decision==="accepted"?new Date().toISOString():null,
  decided_at:new Date().toISOString(),updated_at:new Date().toISOString()
 }).eq("id",id).eq("project_id",projectId);
 if(error)fail(projectId,error.message);refresh(projectId);redirect(`/jobs/${projectId}/variations`);
}

export async function releaseVariation(formData:FormData){
 const {supabase}=await requireAnyPermission(["commercial:edit"]);const projectId=String(formData.get("project_id")??"");const id=String(formData.get("variation_id")??"");
 const {data:v}=await supabase.from("variations").select("status").eq("id",id).eq("project_id",projectId).single();
 if(v?.status!=="accepted")fail(projectId,"Client acceptance is required before release to site");
 const {error}=await supabase.from("variations").update({status:"released",released_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);
 if(error)fail(projectId,error.message);refresh(projectId);redirect(`/jobs/${projectId}/variations`);
}
