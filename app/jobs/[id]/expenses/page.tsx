import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/access";
import { submitExpense, reviewExpense } from "./actions";

export default async function ExpensesPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{error?:string;saved?:string}>}) {
 const {id}=await params; const msg=await searchParams;
 const {supabase,role}=await requireAnyPermission(["expenses:submit","expenses:review"]);
 const {data:project}=await supabase.from("projects").select("id,reference,title").eq("id",id).single();
 if(!project) notFound();
 const {data:rows}=await supabase.from("worker_expenses").select("id,expense_date,category,amount,note,receipt_path,status,created_at,profiles:submitted_by(full_name)").eq("project_id",id).order("created_at",{ascending:false});
 const enriched=await Promise.all((rows||[]).map(async row=>{const s=await supabase.storage.from("worker-receipts").createSignedUrl(row.receipt_path,900);return {...row,receiptUrl:s.data?.signedUrl||null};}));
 return <div className="standalone-page">
  <section className="page-heading"><div><p className="eyebrow">{project.reference}</p><h1>Expenses</h1><p>{project.title} · Receipt-backed site expenses</p></div><Link className="secondary-button" href={`/jobs/${id}`}>Back to job</Link></section>
  {msg.error?<div className="notice error-notice">{msg.error}</div>:null}{msg.saved?<div className="notice success-notice">Expense submitted for approval.</div>:null}
  {can(role,"expenses:submit")?<section className="panel"><div className="panel-head"><div><p className="eyebrow">Worker claim</p><h2>Add expense</h2></div></div>
   <form action={submitExpense} className="form-grid" encType="multipart/form-data"><input type="hidden" name="project_id" value={id}/>
    <label><span>Type</span><select name="category" defaultValue="evening_meal"><option value="evening_meal">Evening meal</option><option value="travel">Travel</option><option value="parking">Parking</option><option value="materials">Materials</option><option value="other">Other</option></select></label>
    <label><span>Amount (£)</span><input name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" required/></label>
    <label className="form-span-2"><span>Receipt</span><input name="receipt" type="file" accept="image/*,application/pdf" capture="environment" required/><small>Photograph the receipt now. Claims are not submitted without evidence.</small></label>
    <label className="form-span-2"><span>Note (optional)</span><input name="note" placeholder="Only add a note if it helps explain the cost"/></label>
    <div className="form-span-2"><button className="primary-button" type="submit">Submit expense</button></div>
   </form></section>:null}
  <section className="panel"><div className="panel-head"><div><p className="eyebrow">History</p><h2>{can(role,"expenses:review")?"Project expenses":"My submitted expenses"}</h2></div></div>
   {enriched.length?<div className="expense-list">{enriched.map((row:any)=><article className="expense-card" key={row.id}><div><span>{row.expense_date} · {String(row.category).replaceAll("_"," ")}</span><strong>£{Number(row.amount).toFixed(2)}</strong><small>{row.profiles?.full_name||"Worker"}{row.note?` · ${row.note}`:""}</small></div><div className="expense-actions"><b className="status-badge">{row.status}</b>{row.receiptUrl?<a className="text-button" href={row.receiptUrl} target="_blank" rel="noreferrer">View receipt</a>:null}</div>
    {can(role,"expenses:review")&&row.status!=="paid"?<form action={reviewExpense} className="expense-review"><input type="hidden" name="project_id" value={id}/><input type="hidden" name="expense_id" value={row.id}/><input name="review_note" placeholder="Review note (optional)"/><button className="secondary-button" name="status" value="approved">Approve</button><button className="secondary-button" name="status" value="rejected">Reject</button>{row.status==="approved"?<button className="primary-button" name="status" value="paid">Mark paid</button>:null}</form>:null}
   </article>)}</div>:<div className="empty-state compact-empty"><strong>No expenses yet.</strong><p>Submitted receipts will appear here.</p></div>}
  </section>
 </div>;
}