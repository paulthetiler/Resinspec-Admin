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
 const file=formData.get("invoice"), note=val(formData.get("note"))||null;
 if(!projectId||!invoiceNumber||!invoiceDate||!Number.isFinite(amount)||amount<=0||!(file instanceof File)||!file.size)
  redirect(`/jobs/${projectId}/cis-invoices?error=Invoice%20number%2C%20date%2C%20amount%20and%20file%20are%20required`);
 const {data:claims}=await supabase.auth.getClaims(); const uid=claims?.claims?.sub; if(!uid) redirect("/login");
 const path=`${projectId}/${uid}/${Date.now()}-${safe(file.name||"invoice.pdf")}`;
 const up=await supabase.storage.from("cis-invoices").upload(path,file,{contentType:file.type||"application/pdf",upsert:false});
 if(up.error) redirect(`/jobs/${projectId}/cis-invoices?error=${encodeURIComponent(up.error.message)}`);
 const {error}=await supabase.from("subcontractor_invoices").insert({project_id:projectId,submitted_by:uid,invoice_number:invoiceNumber,invoice_date:invoiceDate,gross_amount:amount,note,invoice_path:path});
 if(error){await supabase.storage.from("cis-invoices").remove([path]);redirect(`/jobs/${projectId}/cis-invoices?error=${encodeURIComponent(error.message)}`);}
 revalidatePath(`/jobs/${projectId}/cis-invoices`); redirect(`/jobs/${projectId}/cis-invoices?submitted=1`);
}
export async function reviewCisInvoice(formData:FormData){
 const {supabase}=await requireAnyPermission(["invoices:review"]);
 const projectId=val(formData.get("project_id")),id=val(formData.get("invoice_id")),status=val(formData.get("status")),reviewNote=val(formData.get("review_note"))||null;
 if(!projectId||!id||!["approved","rejected","paid"].includes(status)) redirect("/jobs");
 const {data:claims}=await supabase.auth.getClaims(); const now=new Date().toISOString();
 const {error}=await supabase.from("subcontractor_invoices").update({status,reviewed_by:claims?.claims?.sub??null,reviewed_at:now,review_note:reviewNote,paid_at:status==="paid"?now:null,updated_at:now}).eq("id",id).eq("project_id",projectId);
 if(error) redirect(`/jobs/${projectId}/cis-invoices?error=${encodeURIComponent(error.message)}`);
 revalidatePath(`/jobs/${projectId}/cis-invoices`); redirect(`/jobs/${projectId}/cis-invoices?reviewed=${status}`);
}