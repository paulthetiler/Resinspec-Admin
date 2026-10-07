"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireAnyPermission} from "@/lib/access";
const val=(v:FormDataEntryValue|null)=>String(v??"").trim();
const safe=(s:string)=>s.replace(/[^a-zA-Z0-9._-]/g,"-").slice(-120);

export async function submitCisInvoice(formData:FormData){
 const {supabase}=await requireAnyPermission(["invoices:submit"]);
 const projectId=val(formData.get("project_id")), invoiceNumber=val(formData.get("invoice_number"));
 const amount=Number(formData.get("gross_amount")), invoiceDate=val(formData.get("invoice_date"));
 const file=formData.get("invoice"), note=val(formData.get("note"))||null, supersedesId=val(formData.get("supersedes_id"))||null;
 let revision=1;
 if(supersedesId){const {data:old}=await supabase.from("subcontractor_invoices").select("revision,invoice_number,status").eq("id",supersedesId).eq("project_id",projectId).single(); if(!old||old.status!=="correction_required") redirect(`/jobs/${projectId}/cis-invoices?error=That%20invoice%20is%20not%20waiting%20for%20a%20correction`); revision=Number(old.revision)+1;}
 if(!projectId||!invoiceNumber||!invoiceDate||!Number.isFinite(amount)||amount<=0||!(file instanceof File)||!file.size)
  redirect(`/jobs/${projectId}/cis-invoices?error=Invoice%20number%2C%20date%2C%20amount%20and%20file%20are%20required`);
 const {data:claims}=await supabase.auth.getClaims(); const uid=claims?.claims?.sub; if(!uid) redirect("/login");
 const path=`${projectId}/${uid}/${Date.now()}-${safe(file.name||"invoice.pdf")}`;
 const up=await supabase.storage.from("cis-invoices").upload(path,file,{contentType:file.type||"application/pdf",upsert:false});
 if(up.error) redirect(`/jobs/${projectId}/cis-invoices?error=${encodeURIComponent(up.error.message)}`);
 const {error}=await supabase.from("subcontractor_invoices").insert({project_id:projectId,submitted_by:uid,invoice_number:invoiceNumber,invoice_date:invoiceDate,gross_amount:amount,note,invoice_path:path,revision,supersedes_id:supersedesId});
 if(!error&&supersedesId) await supabase.from("subcontractor_invoices").update({status:"superseded",updated_at:new Date().toISOString()}).eq("id",supersedesId).eq("submitted_by",uid);
 if(error){await supabase.storage.from("cis-invoices").remove([path]);redirect(`/jobs/${projectId}/cis-invoices?error=${encodeURIComponent(error.message)}`);}
 revalidatePath(`/jobs/${projectId}/cis-invoices`); redirect(`/jobs/${projectId}/cis-invoices?submitted=1`);
}
export async function reviewCisInvoice(formData:FormData){
 const {supabase}=await requireAnyPermission(["invoices:review"]);
 const projectId=val(formData.get("project_id")),id=val(formData.get("invoice_id")),status=val(formData.get("status")),reviewNote=val(formData.get("review_note"))||null;
 if(!projectId||!id||!["approved","correction_required","rejected","paid"].includes(status)) redirect("/jobs");
 const approvedRaw=val(formData.get("approved_amount")); const approvedAmount=approvedRaw?Number(approvedRaw):null;
 if(status==="correction_required"&&!reviewNote) redirect(`/jobs/${projectId}/cis-invoices?error=Give%20the%20subcontractor%20a%20reason%20for%20the%20correction`);
 const {data:claims}=await supabase.auth.getClaims(); const now=new Date().toISOString();
 const {data:invoice,error}=await supabase.from("subcontractor_invoices").update({status,approved_amount:status==="approved"?(approvedAmount??undefined):undefined,adjustment_reason:status==="correction_required"?reviewNote:null,reviewed_by:claims?.claims?.sub??null,reviewed_at:now,review_note:reviewNote,paid_at:status==="paid"?now:null,updated_at:now}).eq("id",id).eq("project_id",projectId).select("submitted_by,invoice_number,gross_amount,approved_amount").single();
 if(!error&&invoice&&["approved","correction_required","rejected","paid"].includes(status)){const title=status==="approved"?`Invoice ${invoice.invoice_number} approved`:status==="correction_required"?`Invoice ${invoice.invoice_number} needs correction`:status==="paid"?`Invoice ${invoice.invoice_number} marked paid`:`Invoice ${invoice.invoice_number} rejected`; const body=status==="approved"?`Approved for £${Number(invoice.approved_amount??invoice.gross_amount).toFixed(2)}.`:status==="correction_required"?`Please upload a corrected invoice. ${reviewNote}`:status==="paid"?"Payment has been marked as paid.":reviewNote||"The invoice was not approved."; await supabase.from("user_notifications").insert({user_id:invoice.submitted_by,project_id:projectId,kind:`cis_invoice_${status}`,title,body,href:`/jobs/${projectId}/cis-invoices`});}
 if(error) redirect(`/jobs/${projectId}/cis-invoices?error=${encodeURIComponent(error.message)}`);
 revalidatePath(`/jobs/${projectId}/cis-invoices`); redirect(`/jobs/${projectId}/cis-invoices?reviewed=${status}`);
}