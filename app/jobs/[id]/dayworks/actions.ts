"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireAnyPermission} from "@/lib/access";
const t=(v:FormDataEntryValue|null)=>String(v??"").trim()||null;
function back(id:string){revalidatePath(`/jobs/${id}/dayworks`);revalidatePath(`/jobs/${id}/variations`);redirect(`/jobs/${id}/dayworks`)}
export async function submitDaywork(fd:FormData){
 const {supabase}=await requireAnyPermission(["variations:raise"]);const projectId=String(fd.get("project_id")??"");
 const {count}=await supabase.from("daywork_sheets").select("id",{count:"exact",head:true}).eq("project_id",projectId);
 const reference=`DW-${String((count??0)+1).padStart(3,"0")}`;const {data:claims}=await supabase.auth.getClaims();
 const labour=[{description:t(fd.get("labour_description")),hours:Number(fd.get("labour_hours")||0)}].filter(x=>x.description);
 const plant=[{description:t(fd.get("plant_description")),hours:Number(fd.get("plant_hours")||0)}].filter(x=>x.description);
 const materials=[{description:t(fd.get("materials"))}].filter(x=>x.description);
 const {error}=await supabase.from("daywork_sheets").insert({project_id:projectId,variation_id:t(fd.get("variation_id")),reference,work_date:String(fd.get("work_date")||""),instruction_by_name:t(fd.get("instruction_by_name")),instruction_by_company:t(fd.get("instruction_by_company")),work_description:t(fd.get("work_description")),labour,plant,materials,evidence_notes:t(fd.get("evidence_notes")),status:"submitted",submitted_by:claims?.claims?.sub??null,submitted_at:new Date().toISOString()});
 if(error)redirect(`/jobs/${projectId}/dayworks?error=${encodeURIComponent(error.message)}`);back(projectId);
}
export async function acknowledgeDaywork(fd:FormData){
 const {supabase}=await requireAnyPermission(["commercial:edit"]);const projectId=String(fd.get("project_id")??"");const id=String(fd.get("daywork_id")??"");const decision=String(fd.get("decision")??"acknowledged");
 const {error}=await supabase.from("daywork_sheets").update({status:decision,client_name:t(fd.get("client_name")),client_position:t(fd.get("client_position")),client_company:t(fd.get("client_company")),client_email:t(fd.get("client_email")),client_acknowledgement_note:t(fd.get("client_acknowledgement_note")),client_acknowledged_at:decision==="acknowledged"?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",id).eq("project_id",projectId);
 if(error)redirect(`/jobs/${projectId}/dayworks?error=${encodeURIComponent(error.message)}`);back(projectId);
}
